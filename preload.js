const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
    'api', {
        // Data loading
        onLoadData: (callback) => ipcRenderer.on('load-data', callback),
        
        // Filter handling
        sendFilterData: (filterData) => ipcRenderer.send('filter-data', filterData),
        onFilteredData: (callback) => ipcRenderer.on('filtered-data', callback),
        
        // Error handling
        onError: (callback) => ipcRenderer.on('error', callback),
        
        // Clean up listeners when needed
        removeAllListeners: (channel) => {
            const validChannels = ['load-data', 'filtered-data', 'error'];
            if (validChannels.includes(channel)) {
                ipcRenderer.removeAllListeners(channel);
            }
        }
    }
); 