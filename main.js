const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');

// Configuration constants
const CONFIG = {
    minYear: 1990,
    windowWidth: 800,
    windowHeight: 600,
    jsonPath: path.join(__dirname, 'assets', 'Doc Solus.json')
};

const isProduction = process.env.NODE_ENV === 'production';
let mainWindow;
let jsonData = null; // Store JSON data in memory

function createWindow() {
    mainWindow = new BrowserWindow({
        width: CONFIG.windowWidth,
        height: CONFIG.windowHeight,
        webPreferences: {
            nodeIntegration: !isProduction,
            contextIsolation: isProduction,
            preload: isProduction ? path.join(__dirname, 'preload.js') : undefined
        }
    });

    mainWindow.loadFile('index.html');
}

// Load JSON data and initialize application
async function initializeApp() {
    try {
        const data = await fs.promises.readFile(CONFIG.jsonPath, 'utf-8');
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
    const parsedMin = parseInt(min);
    const parsedMax = parseInt(max);

    if (!Number.isNaN(parsedMin) && (parsedMin < CONFIG.minYear || parsedMin > currentYear)) {
        return false;
    }
    if (!Number.isNaN(parsedMax) && (parsedMax < CONFIG.minYear || parsedMax > currentYear)) {
        return false;
    }
    if (!Number.isNaN(parsedMin) && !Number.isNaN(parsedMax) && parsedMin > parsedMax) {
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

    // Ensure concours is an array
    const concoursFilter = Array.isArray(filters.concours) ? filters.concours : [];

    // Apply filters without keywords first
    const filteredWithoutKeywords = jsonData.filter(item => {
        const matchMatiere = !filters.matiere || item["Matière"] === filters.matiere;
        const matchFiliere = !filters.filiere || item["Filière"] === filters.filiere;
        const matchConcours = concoursFilter.length === 0 || concoursFilter.includes(item["Concours"]);
        const matchAnneeMin = !filters.anneeMin || parseInt(item["Année"]) >= filters.anneeMin;
        const matchAnneeMax = !filters.anneeMax || parseInt(item["Année"]) <= filters.anneeMax;

        return matchMatiere && matchFiliere && matchConcours && matchAnneeMin && matchAnneeMax;
    });

    // Then apply keyword filter
    const filtered = filteredWithoutKeywords.filter(item => {
        const keywords = filters.keywords || [];
        const itemKeywords = item["Mots_clés"] ? item["Mots_clés"].toLowerCase().split(/[,\s]+/) : [];
        return keywords.length === 0 || keywords.some(keyword => 
            itemKeywords.some(itemKeyword => itemKeyword.includes(keyword))
        );
    });

    // Get counts
    const uniqueSujetsTotal = new Set(filteredWithoutKeywords.map(item => item["Nom"]));
    const uniqueSujetsCorrespondants = new Set(filtered.map(item => item["Nom"]));
    const totalSujets = uniqueSujetsTotal.size;
    const totalSujetsCorrespondants = uniqueSujetsCorrespondants.size;

    if (totalSujets === 0) {
        event.sender.send('filtered-data', { resultats: {}, totalSujets: 0, totalSujetsCorrespondants: 0 });
        return;
    }

    // Count occurrences for the filtered results
    const counts = filtered.reduce((acc, item) => {
        const motCle = item["Mots_clés"];
        if (motCle) {
            if (!acc[motCle]) {
                acc[motCle] = { count: 0 };
            }
            acc[motCle].count++;
        }
        return acc;
    }, {});

    // Second pass: calculate percentages
    const resultats = Object.keys(counts).reduce((res, key) => {
        res[key] = {
            count: counts[key].count,
            percentage: (counts[key].count / totalSujets) * 100
        };
        return res;
    }, {});

    event.sender.send('filtered-data', { resultats, totalSujets, totalSujetsCorrespondants });
});
