const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');

let mainWindow;
let jsonData = null; // Store JSON data in memory

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
            // TODO: For production, enable contextIsolation and use preload script
        }
    });

    mainWindow.loadFile('index.html');
}

// Load JSON data and initialize application
async function initializeApp() {
    try {
        const jsonPath = path.join(__dirname, 'assets', 'Doc Solus.json');
        const data = await fs.promises.readFile(jsonPath, 'utf-8');
        jsonData = JSON.parse(data);
        
        createWindow();
        
        mainWindow.webContents.once('did-finish-load', () => {
            sendInitialData();
        });
    } catch (error) {
        console.error('Erreur d\'initialisation:', error);
        app.quit();
    }
}

app.whenReady().then(initializeApp);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// Send initial data to populate filters
function sendInitialData() {
    if (!jsonData) {
        console.error('Données JSON non disponibles');
        return;
    }

    // Extract unique values using Set
    const matieres = [...new Set(jsonData.map(item => item["Matière"]))].sort();
    const filieres = [...new Set(jsonData.map(item => item["Filière"]))].sort();
    const annees = [...new Set(jsonData.map(item => item["Année"]))].sort((a, b) => b - a);
    const concours = [...new Set(jsonData.map(item => item["Concours"]))].sort();

    mainWindow.webContents.send('load-data', { matieres, filieres, annees, concours });
}

// Validate year range
function validateYearRange(min, max) {
    const currentYear = new Date().getFullYear();
    const minYear = 1990; // Adjust this based on your data requirements

    min = parseInt(min);
    max = parseInt(max);

    if (min && (min < minYear || min > currentYear)) {
        return false;
    }
    if (max && (max < minYear || max > currentYear)) {
        return false;
    }
    if (min && max && min > max) {
        return false;
    }

    return true;
}

// Handle filter requests
ipcMain.on('filter-data', (event, filters) => {
    if (!jsonData) {
        event.sender.send('error', 'Données non disponibles');
        return;
    }

    // Validate year range
    if (!validateYearRange(filters.anneeMin, filters.anneeMax)) {
        event.sender.send('error', 'Plage d\'années invalide');
        return;
    }

    console.log('Filtres appliqués:', filters); // Debug log

    // Apply filters
    const filtered = jsonData.filter(item => {
        const matchMatiere = !filters.matiere || item["Matière"] === filters.matiere;
        const matchFiliere = !filters.filiere || item["Filière"] === filters.filiere;
        const matchConcours = filters.concours.length === 0 || filters.concours.includes(item["Concours"]);
        const matchAnneeMin = !filters.anneeMin || parseInt(item["Année"]) >= filters.anneeMin;
        const matchAnneeMax = !filters.anneeMax || parseInt(item["Année"]) <= filters.anneeMax;

        return matchMatiere && matchFiliere && matchConcours && matchAnneeMin && matchAnneeMax;
    });

    // Calculate statistics using reduce
    const totalItems = filtered.length;
    if (totalItems === 0) {
        event.sender.send('filtered-data', { resultats: {}, totalSujets: 0 });
        return;
    }

    const resultats = filtered.reduce((acc, item) => {
        const motCle = item["Mots_clés"];
        if (motCle) {
            if (!acc[motCle]) {
                acc[motCle] = { count: 0, percentage: 0 };
            }
            acc[motCle].count++;
            acc[motCle].percentage = (acc[motCle].count / totalItems) * 100;
        }
        return acc;
    }, {});

    event.sender.send('filtered-data', { resultats, totalSujets: totalItems });
});
