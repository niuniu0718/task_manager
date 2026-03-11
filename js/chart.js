// 图表管理
const ChartManager = {
    statusChart: null,
    ownerChart: null,

    // 初始化状态分布饼图
    initStatusChart() {
        const ctx = document.getElementById('statusChart').getContext('2d');
        this.statusChart = new Chart(ctx, {
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

    // 初始化责任人分布柱状图
    initOwnerChart() {
        const ctx = document.getElementById('ownerChart').getContext('2d');
        this.ownerChart = new Chart(ctx, {
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

    // 更新状态图表
    updateStatusChart(ongoing, delayed, completed) {
        if (this.statusChart) {
            this.statusChart.data.datasets[0].data = [ongoing, delayed, completed];
            this.statusChart.update();
        }
    },

    // 更新部门图表
    updateOwnerChart(ownerData) {
        if (this.ownerChart) {
            const labels = ownerData.map(o => o.department);
            const data = ownerData.map(o => o.total);
            this.ownerChart.data.labels = labels;
            this.ownerChart.data.datasets[0].data = data;
            this.ownerChart.update();
        }
    },

    // 初始化所有图表
    init() {
        this.initStatusChart();
        this.initOwnerChart();
    }
};
