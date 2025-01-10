// ==UserScript==
// @name         哔哩哔哩收藏夹导出
// @namespace    https://github.com/vanilla-tiramisu/Bilibili-Favlist-Export
// @icon         https://www.bilibili.com/favicon.ico
// @require      https://ajax.googleapis.com/ajax/libs/jquery/3.7.1/jquery.min.js
// @version      3.0.0
// @license      GPL-3.0
// @description  （适配新版页面）导出哔哩哔哩收藏夹为 CSV 或 HTML 文件，以便导入 Raindrop 或 Firefox。
// @author       AHCorn, vanilla-tiramisu
// @match        http*://space.bilibili.com/*/*
// @grant        GM_addStyle
// @grant        GM_download
// @grant        GM_registerMenuCommand
// @grant        GM_setValue
// @grant        GM_getValue
// @updateURL    https://github.com/vanilla-tiramisu/Bilibili-Favlist-Export/raw/main/Bilibili-Favlist-Export.user.js
// @downloadURL  https://github.com/vanilla-tiramisu/Bilibili-Favlist-Export/raw/main/Bilibili-Favlist-Export.user.js
// ==/UserScript==


(function () {
    'use strict';

    const DELAY = 2000;
    let csvHeaderOptions = {
        title: "\uFEFFtitle",
        url: "url",
        foldername: "folder",
        created: "created"
    };
    let csvHeaderActive = ["\uFEFFtitle", "url", "folder", "created"];
    function updateCSVHeader() {
        csvHeaderActive = Object.keys(csvHeaderOptions).filter(option => csvInclude[option]).map(option => csvHeaderOptions[option]);
    }
    let csvContent = csvHeaderActive.join(",") + "\n";
    let htmlTemplateStart = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>{BOOKMARK_TITLE}</H1>
<DL><p><DT><H3 ADD_DATE="{dateNow}" LAST_MODIFIED="{dateNow}">{globalFolderName}</H3>\n<DL><p>`;
    const HTML_TEMPLATE_END = `</DL><p>`;
    let htmlContent = "";
    let globalParentFolderName = "";
    let csvInclude = {
        title: true,
        url: true,
        foldername: true,
        created: true
    };
    let exportCurrentFolderOnly = false;

    GM_addStyle(`
        #bilibili-export-panel {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: linear-gradient(135deg, #f6f8fa, #e9ecef);
            border-radius: 24px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1), 0 1px 8px rgba(0, 0, 0, 0.06);
            padding: 30px;
            width: 90%;
            max-width: 400px;
            display: none;
            z-index: 10000;
            font-family: 'Segoe UI', 'Roboto', sans-serif;
            transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
        }

        #bilibili-export-panel h2 {
            margin: 0 0 20px;
            color: #00a1d6;
            font-size: 28px;
            text-align: center;
            font-weight: 700;
        }

        #current-exporting {
            margin-bottom: 20px;
            padding: 10px;
            background-color: rgba(0, 161, 214, 0.1);
            border-left: 4px solid #00a1d6;
            border-right: 4px solid #00a1d6;
            border-radius: 4px;
            font-size: 14px;
            color: #00a1d6;
            text-align: center;
            transition: all 0.5s ease;
        }

        #current-exporting.completed {
            background-color: rgba(76, 175, 80, 0.1);
            border-left-color: #4CAF50;
            border-right-color: #4CAF50;
            color: #4CAF50;
        }

        @keyframes pulse {
            0% {
                transform: scale(1);
            }
            50% {
                transform: scale(1.05);
            }
            100% {
                transform: scale(1);
            }
        }

        #current-exporting.completed {
            animation: pulse 0.5s ease-in-out;
        }

        #formatSelector {
            display: flex;
            justify-content: center;
            align-items: center;
            margin-bottom: 25px;
            position: relative;
            background-color: #e0e0e0;
            border-radius: 20px;
            padding: 5px;
            box-shadow: inset 0 2px 4px rgba(0,0,0,0.1);
        }

        .formatButton {
            z-index: 1;
            padding: 10px 20px;
            font-size: 16px;
            color: #3c4043;
            cursor: pointer;
            transition: color 0.3s ease-in-out;
            font-weight: 600;
            flex: 1;
            text-align: center;
        }

        .formatButton.selected {
            color: #FFF;
        }

        .slider {
            position: absolute;
            left: 5px;
            top: 5px;
            background-color: #00a1d6;
            border-radius: 15px;
            transition: transform 0.3s ease-in-out;
            height: calc(100% - 10px);
            width: calc(50% - 5px);
            z-index: 0;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }

        .toggle-switch {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 12px;
            padding: 10px 15px;
            background-color: #f1f3f4;
            border-radius: 12px;
            transition: all 0.3s ease;
        }

        .toggle-switch:hover {
            background-color: #e8eaed;
        }

        .toggle-switch label {
            font-size: 16px;
            color: #3c4043;
            font-weight: 600;
        }

        .switch {
            position: relative;
            display: inline-block;
            width: 52px;
            height: 28px;
        }

        .switch input {
            opacity: 0;
            width: 0;
            height: 0;
        }

        .switch-slider {
            position: absolute;
            cursor: pointer;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: #ccc;
            transition: .4s;
            border-radius: 34px;
        }

        .switch-slider:before {
            position: absolute;
            content: "";
            height: 20px;
            width: 20px;
            left: 4px;
            bottom: 4px;
            background-color: white;
            transition: .4s;
            border-radius: 50%;
        }

        input:checked + .switch-slider {
            background-color: #00a1d6;
        }

        input:checked + .switch-slider:before {
            transform: translateX(24px);
        }

        #export-button {
            display: block;
            width: 100%;
            padding: 12px;
            background-color: #00a1d6;
            color: white;
            border: none;
            border-radius: 12px;
            font-size: 18px;
            font-weight: bold;
            cursor: pointer;
            transition: all 0.3s ease;
            margin-top: 20px;
            position: relative;
            overflow: hidden;
        }

        #export-button:hover {
            background-color: #0091c2;
            transform: translateY(-2px);
            box-shadow: 0 4px 8px rgba(0, 161, 214, 0.3);
        }

        #export-button:disabled {
            background-color: #cccccc;
            cursor: not-allowed;
        }

        #export-button::after {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            height: 100%;
            width: 0%;
            background-color: rgba(255,255,255,0.2);
            transition: width 0.3s ease;
        }

        .input-group {
            margin-bottom: 15px;
        }

        .input-group input {
            width: calc(100% - 20px);
            padding: 10px;
            border: 1px solid #dadce0;
            border-radius: 8px;
            font-size: 14px;
        }

        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }

        @keyframes slideIn {
            from { transform: translate(-50%, -60%); }
            to { transform: translate(-50%, -50%); }
        }

        #bilibili-export-panel.show {
            display: block;
            animation: fadeIn 0.3s ease-out, slideIn 0.3s ease-out;
        }

        #panel-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.5);
            z-index: 9999;
            display: none;
        }
    `);

    let gen = listGen();
    let panel = null;
    let exportButton = null;
    let formatButtons = null;
    let folderInputSection = null;
    let bookmarkTitleInput = null;
    let globalFolderNameInput = null;
    let lastAddedFolderName = "";
    let totalPage = 1;
    let currentPage = 0;
    let isExporting = false;
    let exportFormat = GM_getValue('exportFormat', 'csv');

    function getCSVFileName() {
        let userName = $(".nickname").text();
        return userName + "的收藏夹.csv";
    }

    function getHTMLFileName() {
        let userName = $(".nickname").text();
        return userName + "的收藏夹.html";
    }

    function getFolderName() {
        return document.querySelector(".favlist-info-detail__title .vui_ellipsis").innerHTML;
    }

    function escapeCSV(field) {
        return '"' + String(field).replace(/"/g, '""') + '"';
    }

    function getCurrentTimestamp() {
        return Math.floor(Date.now() / 1000);
    }

    function addHTMLFolder(folderName) {
        let dateNow = getCurrentTimestamp();
        if (folderName !== lastAddedFolderName) {
            if (lastAddedFolderName !== "") {
                htmlContent += `</DL><p>\n`;
            }
            htmlContent += `<DT><H3 ADD_DATE="${dateNow}" LAST_MODIFIED="${dateNow}">${folderName}</H3>\n<DL><p>\n`;
            lastAddedFolderName = folderName;
        }
    }

    function addHTMLBookmark(folderName, title, url, created) {
        addHTMLFolder(folderName);
        let dateNow = new Date(created).getTime() / 1000;
        htmlContent += `<DT><A HREF="${url}" ADD_DATE="${dateNow}" LAST_MODIFIED="${dateNow}">${title}</A>\n`;
    }

    function generateCSVLine(folderName, title, url, created) {
        let parts = [];
        if (csvInclude.title) parts.push(escapeCSV(title));
        if (csvInclude.url) parts.push(escapeCSV(url));
        if (csvInclude.foldername) parts.push(escapeCSV(folderName));
        if (csvInclude.created) parts.push(escapeCSV(created));
        return parts.join(',');
    }

    function parseTime(timeText) {
        return timeText.slice(3);
    }

    function getVideosFromPage() {
        var results = [];
        var folderName = getFolderName().replace(/\//g, '\\');
        $(".fav-list-main .items__item").each(function () {
            var titleElement = this.querySelector(".bili-video-card__title");
            var title = titleElement.title.replace(/,/g, '');
            if (title !== "已失效视频") {
                let url = this.querySelector(".bili-video-card__title a").href
                let subtitle = this.querySelector(".bili-video-card__subtitle a")
                let timeText = ''
                if (subtitle) // 一般视频
                    timeText = subtitle.querySelector("div:last-child>span").title
                else { // 特殊视频
                    timeText = this.querySelector(".bili-video-card__subtitle>span").title
                    title = timeText.trim().split("·")[0].trim();
                }
                var created = parseTime(timeText.trim().split("·").slice(-1)[0].trim());
                results.push(generateCSVLine(folderName, title, url, created));
                if (exportFormat === "html") {
                    addHTMLBookmark(folderName, title, url, created);
                }
            }
        });
        return results.join('\n');
    }

    function processVideos() {
        if (isExporting) {
            csvContent += getVideosFromPage() + '\n';
            currentPage++;
            updateProgress(Math.round((currentPage / totalPage) * 100));
            if (currentPage >= totalPage) {
                if (exportCurrentFolderOnly) {
                    finishExport();
                } else {
                    setTimeout(changeList, DELAY);
                }
            } else {
                $(".vui_pagenation--btn-side").click();
                setTimeout(processVideos, DELAY);
            }
        }
    }

    function* listGen() {
        for (let list of $(".fav-collapse:nth-child(-n+2) .vui_collapse_item .fav-sidebar-item .vui_sidebar-item").get()) {
            yield list;
        }
    }

    function changeList() {
        if (isExporting) {
            if (exportCurrentFolderOnly) {
                processVideos();
            } else {
                let list = gen.next().value;
                if (list) {
                    list.click();
                    setTimeout(() => {
                        let PageCountDesc = document.querySelector(".vui_pagenation-go__count")
                        if (PageCountDesc)
                            totalPage = parseInt(PageCountDesc.innerHTML.match(/\d+/)[0]) || 1;
                        currentPage = 0;
                        updateProgress(0);
                        let currentFolderName = getFolderName();
                        document.querySelector('#current-exporting').textContent = `正在导出：${currentFolderName}`;
                        document.querySelector('#current-exporting').classList.remove('completed');
                        processVideos();
                    }, DELAY);
                } else {
                    finishExport();
                }
            }
        }
    }

    function updateProgress(percentage) {
        exportButton.textContent = `导出中... ${percentage}%`;
        exportButton.style.setProperty('--progress', `${percentage}%`);
        exportButton.style.backgroundImage = `linear-gradient(to right, rgba(255,255,255,0.2) ${percentage}%, transparent ${percentage}%)`;
    }

    function finishExport() {
        isExporting = false;
        exportButton.textContent = "立即下载";
        exportButton.disabled = false;
        let currentExporting = document.querySelector('#current-exporting');
        currentExporting.textContent = "导出完成";
        currentExporting.classList.add('completed');
        exportButton.onclick = () => {
            if (exportFormat === "csv") {
                downloadCSV();
            } else if (exportFormat === "html") {
                downloadHTML();
            }
            exportButton.textContent = "开始导出";
            exportButton.disabled = true;
            setTimeout(() => {
                exportButton.disabled = false;
            }, 3000);
        };
    }

    function startExport() {
        if (exportFormat === "html" && (!bookmarkTitleInput.value || !globalFolderNameInput.value)) {
            alert("请配置书签标题和全局父文件夹名称。");
            return;
        }
        GM_setValue('bookmarkTitle', bookmarkTitleInput.value);
        GM_setValue('globalFolderName', globalFolderNameInput.value);
        exportButton.disabled = true;
        exportButton.textContent = "导出中... 0%";
        isExporting = true;
        htmlContent = "";
        csvContent = "\uFEFF" + csvHeaderActive.join(",") + "\n";
        document.querySelector('#current-exporting').textContent = "准备开始导出...";
        document.querySelector('#current-exporting').classList.remove('completed');
        if (exportCurrentFolderOnly) {
            let PageCountDesc = document.querySelector(".vui_pagenation-go__count")
            if (PageCountDesc)
                totalPage = parseInt(PageCountDesc.innerHTML.match(/\d+/)[0]) || 1;
            currentPage = 0;
            processVideos();
        } else {
            gen = listGen();
            changeList();
        }
    }

    function downloadCSV() {
        let fileName = getCSVFileName();
        let blobUrl = URL.createObjectURL(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }));
        GM_download({
            url: blobUrl,
            name: fileName,
            onload: () => {
                hidePanel();
            },
            onerror: () => {
                alert('下载失败，正在尝试弹出新标签页进行下载，请允许弹窗权限');
                let htmlContent = `
<html>
<head><meta charset="UTF-8"></head>
<body><a href="${blobUrl}" download="${fileName}">点击下载 CSV 文件</a></body>
</html>`;
                let htmlBlob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
                let htmlBlobUrl = URL.createObjectURL(htmlBlob);
                window.open(htmlBlobUrl, '_blank');
            }
        });
    }

    function downloadHTML() {
        let fileName = getHTMLFileName();
        let globalParentFolderName = globalFolderNameInput.value;
        let htmlFinalContent = htmlTemplateStart.replace("{globalFolderName}", globalFolderNameInput.value).replace("{BOOKMARK_TITLE}", bookmarkTitleInput.value.trim()) + htmlContent + HTML_TEMPLATE_END;
        let blobUrl = URL.createObjectURL(new Blob([htmlFinalContent], { type: 'text/html;charset=utf-8;' }));
        GM_download({
            url: blobUrl,
            name: fileName,
            onload: () => {
                hidePanel();
            },
            onerror: () => {
                alert('下载失败，正在尝试弹出新标签页进行下载，请允许弹窗权限');
                let htmlContent = `
<html>
<head><meta charset="UTF-8"></head>
<body><a href="${blobUrl}" download="${fileName}">点击下载 HTML 文件</a></body>
</html>`;
                let htmlBlob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
                let htmlBlobUrl = URL.createObjectURL(htmlBlob);
                window.open(htmlBlobUrl, '_blank');
            }
        });
    }

    function createPanel() {
        panel = document.createElement("div");
        panel.id = "bilibili-export-panel";
        panel.innerHTML = `
        <h2>收藏夹导出设置</h2>
        <div id="current-exporting">点击下方按钮开始导出</div>
        <div id="formatSelector">
            <div class="slider"></div>
            <div class="formatButton" data-format="csv">CSV 格式</div>
            <div class="formatButton" data-format="html">HTML 格式</div>
        </div>
        <div id="csv-options">
            <div class="toggle-switch">
                <label for="include-title">包含标题</label>
                <label class="switch">
                    <input type="checkbox" id="include-title" checked>
                    <span class="switch-slider"></span>
                </label>
            </div>
            <div class="toggle-switch">
                <label for="include-url">包含网址</label>
                <label class="switch">
                    <input type="checkbox" id="include-url" checked>
                    <span class="switch-slider"></span>
                </label>
            </div>
            <div class="toggle-switch">
                <label for="include-foldername">包含收藏夹名称</label>
                <label class="switch">
                    <input type="checkbox" id="include-foldername" checked>
                    <span class="switch-slider"></span>
                </label>
            </div>
            <div class="toggle-switch">
                <label for="include-created">包含收藏时间</label>
                <label class="switch">
                    <input type="checkbox" id="include-created" checked>
                    <span class="switch-slider"></span>
                </label>
            </div>
        </div>
        <div id="html-options" style="display: none;">
            <div class="input-group">
                <input type="text" id="bookmark-title" placeholder="书签标题 (H1)">
            </div>
            <div class="input-group">
                <input type="text" id="global-folder-name" placeholder="全局父文件夹名称">
            </div>
        </div>
        <div class="toggle-switch">
            <label for="export-current-folder-only">仅导出当前文件夹</label>
            <label class="switch">
                <input type="checkbox" id="export-current-folder-only">
                <span class="switch-slider"></span>
            </label>
        </div>
        <button id="export-button">开始导出</button>
    `;
        document.body.appendChild(panel);

        let overlay = document.createElement("div");
        overlay.id = "panel-overlay";
        document.body.appendChild(overlay);

        formatButtons = panel.querySelectorAll('.formatButton');
        formatButtons.forEach(button => {
            button.addEventListener('click', () => {
                exportFormat = button.dataset.format;
                GM_setValue('exportFormat', exportFormat);
                updateFormatButtons();
                toggleOptions();
            });
        });

        folderInputSection = panel.querySelector('#html-options');
        bookmarkTitleInput = panel.querySelector('#bookmark-title');
        globalFolderNameInput = panel.querySelector('#global-folder-name');

        ['title', 'url', 'foldername', 'created'].forEach(option => {
            panel.querySelector(`#include-${option}`).addEventListener('change', (e) => {
                csvInclude[option] = e.target.checked;
                GM_setValue(`include_${option}`, csvInclude[option]);
                updateCSVHeader();
            });
        });

        panel.querySelector('#export-current-folder-only').addEventListener('change', (e) => {
            exportCurrentFolderOnly = e.target.checked;
            GM_setValue('exportCurrentFolderOnly', exportCurrentFolderOnly);
        });

        exportButton = panel.querySelector('#export-button');
        exportButton.onclick = startExport;

        overlay.addEventListener('click', hidePanel);

        updateFormatButtons();
        toggleOptions();
        loadSavedSettings();
    }

    function updateFormatButtons() {
        formatButtons.forEach(button => {
            button.classList.toggle('selected', button.dataset.format === exportFormat);
        });
        const slider = panel.querySelector('.slider');
        slider.style.transform = exportFormat === 'csv' ? 'translateX(0)' : 'translateX(100%)';
    }

    function toggleOptions() {
        panel.querySelector('#csv-options').style.display = exportFormat === 'csv' ? 'block' : 'none';
        panel.querySelector('#html-options').style.display = exportFormat === 'html' ? 'block' : 'none';
    }

    function loadSavedSettings() {
        ['title', 'url', 'foldername', 'created'].forEach(option => {
            const saved = GM_getValue(`include_${option}`);
            if (saved !== undefined) {
                csvInclude[option] = saved;
                panel.querySelector(`#include-${option}`).checked = saved;
            }
        });
        updateCSVHeader();

        bookmarkTitleInput.value = GM_getValue('bookmarkTitle', '');
        globalFolderNameInput.value = GM_getValue('globalFolderName', '');
        exportCurrentFolderOnly = GM_getValue('exportCurrentFolderOnly', false);
        panel.querySelector('#export-current-folder-only').checked = exportCurrentFolderOnly;
    }

    function showPanel() {
        panel.style.opacity = 0;
        panel.style.display = 'block';
        document.getElementById('panel-overlay').style.display = 'block';
        setTimeout(() => {
            panel.style.opacity = 1;
        }, 0);
    }

    function hidePanel() {
        panel.style.opacity = 0;
        document.getElementById('panel-overlay').style.display = 'none';
        setTimeout(() => {
            panel.style.display = 'none';
        }, 300);
    }

    function init() {
        createPanel();
        GM_registerMenuCommand("导出 Bilibili 收藏夹", showPanel);
    }

    if (location.href.includes("https://space.bilibili.com/") && location.href.includes("/favlist")) {
        init();
    }

})();
