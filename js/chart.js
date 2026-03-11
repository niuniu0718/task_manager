// 图表管理 - 性能优化版
const ChartManager = {
    statusChart: null,
    ownerChart: null,
    lastUpdateData: null,

    // 初始化状态分布饼图
    initStatusChart() {
        const ctx = document.getElementById('statusChart');
        if (!ctx) return;

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
                    duration: 300 // 减少动画时间
                },
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            boxWidth: 12,
                            padding: 8,
                            font: { size: 11 }
                        }
                    }
                }
            }
        });
    },

    // 初始化部门分布柱状图
    initOwnerChart() {
        const ctx = document.getElementById('ownerChart');
        if (!ctx) return;

        this.ownerChart = new Chart(ctx.getContext('2d'), {
            type: 'bar',
            data: {
                labels: [],
                datasets: [{
                    label: '任务数',
                    data: [],
                    backgroundColor: '#3B82F6',
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                animation: {
                    duration: 300 // 减少动画时间
                },
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { stepSize: 1 }
                    }
                }
            }
        });
    },

    // 更新状态图表 - 只在数据变化时更新
    updateStatusChart(ongoing, delayed, completed) {
        if (!this.statusChart) return;

        const newData = [ongoing, delayed, completed];
        const currentData = this.statusChart.data.datasets[0].data;

        // 检查数据是否真的变化了
        const hasChanged = newData.some((val, i) => val !== currentData[i]);
        if (!hasChanged) return;

        this.statusChart.data.datasets[0].data = newData;
        this.statusChart.update('none'); // 使用 'none' 模式跳过动画
    },

    // 更新部门图表 - 只在数据变化时更新
    updateOwnerChart(ownerData) {
        if (!this.ownerChart) return;

        const newLabels = ownerData.map(o => o.department);
        const newData = ownerData.map(o => o.total);

        // 检查数据是否真的变化了
        const currentLabels = this.ownerChart.data.labels;
        const currentData = this.ownerChart.data.datasets[0].data;

        const labelsChanged = JSON.stringify(newLabels) !== JSON.stringify(currentLabels);
        const dataChanged = JSON.stringify(newData) !== JSON.stringify(currentData);

        if (!labelsChanged && !dataChanged) return;

        this.ownerChart.data.labels = newLabels;
        this.ownerChart.data.datasets[0].data = newData;
        this.ownerChart.update('none'); // 使用 'none' 模式跳过动画
    },

    // 初始化所有图表
    init() {
        this.initStatusChart();
        this.initOwnerChart();
    }
};
