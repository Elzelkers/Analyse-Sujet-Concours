const { ipcRenderer } = require('electron');

document.addEventListener('DOMContentLoaded', () => {
    // Fonction utilitaire pour remplir un menu déroulant
    function fillSelect(selectId, items, defaultText) {
        const element = document.getElementById(selectId);
        if (!element) return;

        if (selectId === 'anneeMin' || selectId === 'anneeMax') {
            // Configuration des inputs année
            element.min = Math.min(...items);
            element.max = Math.max(...items);
            element.value = selectId === 'anneeMin' ? Math.min(...items) : Math.max(...items);
        } else {
            // Configuration des selects normaux
            element.innerHTML = "";
            if (selectId !== 'concours') {
                const defaultOption = document.createElement("option");
                defaultOption.value = "";
                defaultOption.textContent = defaultText;
                element.appendChild(defaultOption);
            }
            items.forEach(item => {
                const option = document.createElement("option");
                option.value = item;
                option.textContent = item;
                element.appendChild(option);
            });
        }
    }

    // Remplissage des menus dès réception des données
    ipcRenderer.on('load-data', (event, { matieres, filieres, annees, concours }) => {
        fillSelect('matiere', matieres, 'Sélectionner une matière');
        fillSelect('filiere', filieres, 'Sélectionner une filière');
        fillSelect('anneeMin', annees, 'Sélectionner une année min');
        fillSelect('anneeMax', annees, 'Sélectionner une année max');
        fillSelect('concours', concours, 'Sélectionner des concours');
    });

    // Validation des années
    document.getElementById('anneeMin').addEventListener('change', function() {
        const max = document.getElementById('anneeMax');
        if (parseInt(this.value) > parseInt(max.value)) {
            max.value = this.value;
        }
    });

    document.getElementById('anneeMax').addEventListener('change', function() {
        const min = document.getElementById('anneeMin');
        if (parseInt(this.value) < parseInt(min.value)) {
            min.value = this.value;
        }
    });

    // Fonction pour récupérer les mots clés de la barre de recherche
    function getSearchKeywords() {
        const keywords = document.getElementById('search').value.trim().toLowerCase();
        return keywords ? keywords.split(/\s+/) : [];
    }

    // Récupération des valeurs et envoi du filtre lors du clic
    document.getElementById('analyser').addEventListener('click', () => {
        const filterData = {
            matiere: document.getElementById('matiere').value,
            filiere: document.getElementById('filiere').value,
            anneeMin: parseInt(document.getElementById('anneeMin').value),
            anneeMax: parseInt(document.getElementById('anneeMax').value),
            concours: Array.from(document.getElementById('concours').selectedOptions)
                        .filter(option => option.value !== "")
                        .map(option => option.value),
            keywords: getSearchKeywords()
        };
        ipcRenderer.send('filter-data', filterData);
    });

    // Ajout de l'affichage des résultats
    ipcRenderer.on('filtered-data', (event, { resultats, totalSujets, totalSujetsCorrespondants }) => {
        const resultatDiv = document.getElementById('resultats');
        let html = `
            <h3>Résultats de l'analyse${totalSujetsCorrespondants !== undefined ? ` (${totalSujetsCorrespondants} sujet${totalSujetsCorrespondants > 1 ? 's' : ''} correspondant${totalSujetsCorrespondants > 1 ? 's' : ''} aux mots clés)` : ''}</h3>
            <div style="
                background: #e8f4f8;
                padding: 15px;
                border-radius: 5px;
                margin-bottom: 20px;
                font-weight: bold;
                color: #2c3e50;
            ">
                Nombre total de sujets : ${totalSujets}
            </div>
        `;
            
        const entries = Object.entries(resultats);
        if (entries.length === 0) {
            html += '<p>Aucun résultat trouvé pour ces critères.</p>';
        } else {
            html += '<ul>';
            entries
                .sort((a, b) => b[1].count - a[1].count)
                .forEach(([motCle, stats]) => {
                    const width = Math.min(stats.percentage, 100);
                    html += `
                        <li style="position: relative; padding: 10px 15px;">
                            <div style="
                                position: absolute;
                                left: 0;
                                top: 0;
                                bottom: 0;
                                width: ${width}%;
                                background: rgba(52,152,219,0.2);
                                border-radius: 5px;
                                z-index: 0;
                            "></div>
                            <span style="position: relative; z-index: 1;">
                                ${motCle}: ${stats.count} sujet${stats.count > 1 ? 's' : ''} (${stats.percentage.toFixed(1)}%)
                            </span>
                        </li>`;
                });
            html += '</ul>';
        }
        
        resultatDiv.innerHTML = html;
    });
});




