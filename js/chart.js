// 图表管理 - 性能优化版
const ChartManager = {
    statusChart: null,
    ownerChart: null,
    lastUpdateData: null,
    chartAvailable: false,
    taskCount: 0,  // 用于判断是否关闭动画

    // 检查 Chart.js 库是否可用
    checkChartLib() {
        if (typeof Chart === 'undefined') {
            console.warn('Chart.js 库未加载，图表功能不可用');
            // 显示错误提示
            const containers = document.querySelectorAll('.chart-container');
            containers.forEach(container => {
                container.innerHTML = '<div class="chart-error" style="color: #EF4444; padding: 20px; text-align: center;"><p>📊 图表加载失败</p><p style="font-size: 12px; color: #888;">请检查网络连接并刷新页面</p></div>';
            });
            return false;
        }
        return true;
    },

    // 初始化状态分布饼图
    initStatusChart() {
        if (!this.chartAvailable) return;

        const ctx = document.getElementById('statusChart');
        if (!ctx) return;

        try {
            this.statusChart = new Chart(ctx.getContext('2d'), {
                type: 'doughnut',
                data: {
                    labels: ['进行中', '已延期', '已完成'],
                    datasets: [{
                        data: [0, 0, 0],
                        backgroundColor: ['#3B82F6', '#EF4444', '#10B981'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    animation: {
                        duration: 300
                    },
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                boxWidth: 12,
                                padding: 8,
                                font: { size: 11 }
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                    const value = context.raw;
                                    const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                                    return `${context.label}: ${value} (${percentage}%)`;
                                }
                            }
                        }
                    }
                }
            });
        } catch (error) {
            console.error('初始化状态图表失败:', error);
            this.statusChart = null;
        }
    },

    // 初始化部门分布堆叠柱状图
    initOwnerChart() {
        if (!this.chartAvailable) return;

        const ctx = document.getElementById('ownerChart');
        if (!ctx) return;

        try {
            this.ownerChart = new Chart(ctx.getContext('2d'), {
                type: 'bar',
                data: {
                    labels: [],
                    datasets: [
                        {
                            label: '进行中',
                            data: [],
                            backgroundColor: '#3B82F6',
                            borderRadius: 4,
                            stack: 'stack0'
                        },
                        {
                            label: '已延期',
                            data: [],
                            backgroundColor: '#EF4444',
                            borderRadius: 4,
                            stack: 'stack0'
                        },
                        {
                            label: '已完成',
                            data: [],
                            backgroundColor: '#10B981',
                            borderRadius: 4,
                            stack: 'stack0'
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    animation: {
                        duration: 300
                    },
                    onClick: (event, elements) => {
                        if (elements.length > 0) {
                            const index = elements[0].index;
                            const department = this.ownerChart.data.labels[index];
                            // 触发下钻筛选
                            if (typeof App !== 'undefined' && App.filterByDepartment) {
                                App.filterByDepartment(department);
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            display: true,
                            position: 'bottom',
                            labels: {
                                boxWidth: 12,
                                padding: 8,
                                font: { size: 10 }
                            }
                        },
                        tooltip: {
                            callbacks: {
                                afterBody: function(context) {
                                    const dataIndex = context[0].dataIndex;
                                    const chart = context[0].chart;
                                    const datasets = chart.data.datasets;

                                    const ongoing = datasets[0].data[dataIndex] || 0;
                                    const delayed = datasets[1].data[dataIndex] || 0;
                                    const completed = datasets[2].data[dataIndex] || 0;
                                    const total = ongoing + delayed + completed;

                                    if (total > 0) {
                                        const delayRate = ((delayed / total) * 100).toFixed(1);
                                        return [`延期率: ${delayRate}%`, '', '点击查看该部门任务'];
                                    }
                                    return [];
                                }
                            }
                        },
                        title: {
                            display: false
                        }
                    },
                    scales: {
                        x: {
                            stacked: true,
                            ticks: {
                                maxRotation: 45,
                                minRotation: 0,
                                font: { size: 10 },
                                callback: function(value, index) {
                                    const label = this.getLabelForValue(value);
                                    // 截断过长的部门名称
                                    if (label && label.length > 6) {
                                        return label.substring(0, 6) + '...';
                                    }
                                    return label;
                                }
                            }
                        },
                        y: {
                            stacked: true,
                            beginAtZero: true,
                            ticks: { stepSize: 1 }
                        }
                    }
                }
            });
        } catch (error) {
            console.error('初始化部门图表失败:', error);
            this.ownerChart = null;
        }
    },

    // 更新状态图表 - 只在数据变化时更新
    updateStatusChart(ongoing, delayed, completed) {
        if (!this.chartAvailable || !this.statusChart) return;

        const newData = [ongoing, delayed, completed];
        const currentData = this.statusChart.data.datasets[0].data;

        // 检查数据是否真的变化了
        const hasChanged = newData.some((val, i) => val !== currentData[i]);
        if (!hasChanged) return;

        this.statusChart.data.datasets[0].data = newData;

        // 大数据量时关闭动画
        const animationDuration = this.taskCount > 500 ? 0 : 300;
        this.statusChart.options.animation.duration = animationDuration;
        this.statusChart.update(animationDuration === 0 ? 'none' : 'default');
    },

    // 更新部门堆叠柱状图 - 只在数据变化时更新
    updateOwnerChart(ownerData) {
        if (!this.chartAvailable || !this.ownerChart) return;

        const newLabels = ownerData.map(o => o.department);
        const newOngoing = ownerData.map(o => o.ongoing);
        const newDelayed = ownerData.map(o => o.delay);
        const newCompleted = ownerData.map(o => o.close);

        // 检查数据是否真的变化了
        const currentLabels = this.ownerChart.data.labels;
        const currentOngoing = this.ownerChart.data.datasets[0].data;
        const currentDelayed = this.ownerChart.data.datasets[1].data;
        const currentCompleted = this.ownerChart.data.datasets[2].data;

        const labelsChanged = JSON.stringify(newLabels) !== JSON.stringify(currentLabels);
        const dataChanged =
            JSON.stringify(newOngoing) !== JSON.stringify(currentOngoing) ||
            JSON.stringify(newDelayed) !== JSON.stringify(currentDelayed) ||
            JSON.stringify(newCompleted) !== JSON.stringify(currentCompleted);

        if (!labelsChanged && !dataChanged) return;

        this.ownerChart.data.labels = newLabels;
        this.ownerChart.data.datasets[0].data = newOngoing;
        this.ownerChart.data.datasets[1].data = newDelayed;
        this.ownerChart.data.datasets[2].data = newCompleted;

        // 大数据量时关闭动画
        const animationDuration = this.taskCount > 500 ? 0 : 300;
        this.ownerChart.options.animation.duration = animationDuration;
        this.ownerChart.update(animationDuration === 0 ? 'none' : 'default');
    },

    // 设置任务数量（用于动画优化）
    setTaskCount(count) {
        this.taskCount = count;
    },

    // 初始化所有图表
    init() {
        this.chartAvailable = this.checkChartLib();
        if (!this.chartAvailable) return;

        this.initStatusChart();
        this.initOwnerChart();
    }
};
