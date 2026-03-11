// LocalStorage 封装
const STORAGE_KEY = 'taskManagerData';

const TaskStorage = {
    // 获取所有任务
    getTasks() {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error('读取任务数据失败:', error);
            return [];
        }
    },

    // 保存所有任务
    saveTasks(tasks) {
        console.log('TaskStorage.saveTasks called with', tasks.length, 'tasks');
        try {
            const data = JSON.stringify(tasks);
            console.log('Data to save length:', data.length);
            localStorage.setItem(STORAGE_KEY, data);
            console.log('Save successful, verifying...');
            const saved = localStorage.getItem(STORAGE_KEY);
            console.log('Saved data length:', saved?.length);
            return true;
        } catch (error) {
            console.error('保存任务数据失败:', error);
            alert('保存失败: ' + error.message);
            return false;
        }
    },

    // 添加任务
    addTask(task) {
        console.log('TaskStorage.addTask called with:', task);
        const tasks = this.getTasks();
        console.log('Current tasks before add:', tasks);
        tasks.push(task);
        const result = this.saveTasks(tasks);
        console.log('Save result:', result);
        return result;
    },

    // 更新任务
    updateTask(taskId, updates) {
        const tasks = this.getTasks();
        const index = tasks.findIndex(t => t.id === taskId);
        if (index !== -1) {
            tasks[index] = { ...tasks[index], ...updates };
            return this.saveTasks(tasks);
        }
        return false;
    },

    // 删除任务
    deleteTask(taskId) {
        const tasks = this.getTasks().filter(t => t.id !== taskId);
        return this.saveTasks(tasks);
    },

    // 清空所有任务
    clearAll() {
        localStorage.removeItem(STORAGE_KEY);
    }
};
