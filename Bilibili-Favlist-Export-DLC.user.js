// ==UserScript==
// @name         哔哩哔哩图文收藏导出
// @namespace    https://github.com/AHCorn/Bilibili-Favlist-Export
// @icon         https://www.bilibili.com/favicon.ico
// @version      1.2
// @license      GPL-3.0
// @description  导出哔哩哔哩图文收藏为 CSV 或 HTML 文件，以便导入 Raindrop 或 Firefox。
// @author       安和（AHCorn）
// @match        http*://space.bilibili.com/*/favlist*
// @grant        GM_addStyle
// @grant        GM_download
// @grant        GM_registerMenuCommand
// @grant        GM_setValue
// @grant        GM_getValue
// @require      https://cdn.jsdelivr.net/npm/jquery@3.7.1/dist/jquery.min.js
// @updateURL    https://github.com/AHCorn/Bilibili-Favlist-Export/raw/main/Bilibili-Favlist-Export-DLC.user.js
// @downloadURL  https://github.com/AHCorn/Bilibili-Favlist-Export/raw/main/Bilibili-Favlist-Export-DLC.user.js
// ==/UserScript==
(function() {
    'use strict';

    let DELAY = GM_getValue('exportDelay', 2000);
    const DELAY_SPEEDS = {
        slow: 4000,
        normal: 2000,
        fast: 1000
    };

    let csvHeaderOptions = {
        title: "\uFEFFtitle",
        url: "url",
        content: "content",
        created: "created"
    };

    let csvHeaderActive = ["\uFEFFtitle", "url", "content", "created"];
    let csvContent = "";
    let htmlContent = "";
    let currentPage = 0;
    let totalPage = 0;
    let isExporting = false;
    let hasExportedData = false;
    let exportFormat = GM_getValue('exportFormat', 'csv');

    let csvInclude = {
        title: true,
        url: true,
        content: true,
        created: true
    };

    let filterInvalidArticles = GM_getValue('filterInvalidArticles', true);
    let titleMode = GM_getValue('titleMode', 'dynamic');
    let titleLength = GM_getValue('titleLength', 20);

    function updateCSVHeader() {
        csvHeaderActive = Object.keys(csvHeaderOptions)
            .filter(option => csvInclude[option])
            .map(option => csvHeaderOptions[option]);
        csvContent = csvHeaderActive.join(",") + "\n";
    }

    function escapeCSV(field) {
        return '"' + String(field).replace(/"/g, '""') + '"';
    }

    function parseTime(timeText) {
        timeText = timeText.replace(/^收藏于/, '').trim();
        let match = timeText.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
        if (match) {
            return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
        }
        return timeText;
    }

    function getArticlesFromPage() {
        let results = [];

        $(".opus-item").each(function() {
            let title = $(this).find(".opus-item-title").text().trim();
            let url = $(this).find(".opus-item-info").attr("href");
            let content = $(this).find(".opus-item-content").text().trim();
            let timeText = $(this).find(".opus-item-time").text().trim();
            let created = parseTime(timeText);

            if (filterInvalidArticles && !url) {
                return;
            }

            if (!title) {
                if (titleMode === 'dynamic') {
                    title = '动态';
                } else if (titleMode === 'content') {
                    title = content.substring(0, titleLength) || '动态';
                }
            }

            if (url && !url.startsWith("http")) {
                url = "https:" + url;
            }

            let parts = [];
            if (csvInclude.title) parts.push(escapeCSV(title));
            if (csvInclude.url) parts.push(escapeCSV(url || ''));
            if (csvInclude.content) parts.push(escapeCSV(content));
            if (csvInclude.created) parts.push(escapeCSV(created));

            results.push(parts.join(','));

            let timestamp = Math.floor(new Date(created).getTime() / 1000);
            htmlContent += `<DT><A HREF="${url || '#'}" ADD_DATE="${timestamp}" LAST_MODIFIED="${timestamp}">${title}</A>\n`;
        });

        return results.join('\n');
    }

    function processArticles() {
        if (!isExporting) return;

        let articlesData = getArticlesFromPage();
        if (articlesData) {
            csvContent += articlesData + '\n';
        }

        currentPage++;
        updateProgress(Math.round((currentPage / totalPage) * 100));

        let hasNextPage = $(".be-pager-next:not(.be-pager-disabled)").length > 0;

        if (currentPage >= totalPage || !hasNextPage) {
            finishExport();
        } else {
            $(".be-pager-next").click();
            setTimeout(processArticles, DELAY);
        }
    }

    function startExport() {
        if (!$("#h-name").length) {
            alert("您似乎在使用新版页面，该脚本仅适用于旧版页面，请先切换回旧版的图文收藏后再使用。");
            return;
        }

        if (hasExportedData) {
            if (exportFormat === "csv") {
                downloadCSV();
            } else if (exportFormat === "html") {
                if (!bookmarkTitleInput.value || !globalFolderNameInput.value) {
                    alert("请配置书签标题和全局父文件夹名称。");
                    return;
                }
                downloadHTML();
            }
            return;
        }

        updateCSVHeader();
        htmlContent = "";

        isExporting = true;
        currentPage = 0;

        let pagerText = $(".be-pager-total").text();
        let match = pagerText.match(/\d+/);
        totalPage = match ? parseInt(match[0]) : 1;

        processArticles();
    }

    function updateProgress(percentage) {
        exportButton.innerHTML = `<span class="progress-text">导出中... ${percentage}%</span>`;
        exportButton.style.setProperty('--progress', `${percentage}%`);
        exportButton.classList.add('exporting');
    }

    function finishExport() {
        isExporting = false;
        hasExportedData = true;

        if (exportFormat === 'html') {
            htmlContent += '</DL><p>\n</DL><p>';
        }

        exportButton.innerHTML = "立即下载";
        exportButton.classList.remove('exporting');
        document.querySelector('#current-exporting').textContent = "导出完成";
        document.querySelector('#current-exporting').classList.add('completed');
    }

    function getFileName() {
        let userName = $("#h-name").text().trim();
        if (!userName) {
            alert("您似乎在使用新版页面，该脚本仅适用于旧版页面，请先切换回旧版的图文收藏后再使用。");
            return false;
        }
        let extension = exportFormat === 'csv' ? 'csv' : 'html';
        return `${userName}的图文收藏.${extension}`;
    }

    function downloadCSV() {
        if (!csvContent) return;
        let fileName = getFileName();
        if (!fileName) return;
        let blob = new Blob([csvContent], {type: 'text/csv;charset=utf-8;'});
        let url = URL.createObjectURL(blob);
        GM_download({url: url, name: fileName});
    }

    function downloadHTML() {
        if (!htmlContent) return;
        let fileName = getFileName();
        if (!fileName) return;

        let fullHTMLContent = generateHTMLContent();

        let blobUrl = URL.createObjectURL(new Blob([fullHTMLContent], {type: 'text/html;charset=utf-8;'}));
        GM_download({
            url: blobUrl,
            name: fileName,
            onload: () => {},
            onerror: () => {
                alert('下载失败，正在尝试弹出新标签页进行下载，请允许弹窗权限');
                let downloadPage = `
<html>
<head><meta charset="UTF-8"></head>
<body><a href="${blobUrl}" download="${fileName}">点击下载 HTML 文件</a></body>
</html>`;
                let htmlBlob = new Blob([downloadPage], {type: 'text/html;charset=utf-8;'});
                let htmlBlobUrl = URL.createObjectURL(htmlBlob);
                window.open(htmlBlobUrl, '_blank');
            }
        });
    }

    function generateHTMLContent() {
        let dateNow = Math.floor(Date.now() / 1000);
        return `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>${bookmarkTitleInput.value}</TITLE>
<H1>${bookmarkTitleInput.value}</H1>
<DL><p>
<DT><H3 ADD_DATE="${dateNow}" LAST_MODIFIED="${dateNow}">${globalFolderNameInput.value}</H3>
<DL><p>
${htmlContent}
</DL><p>
</DL><p>`;
    }

    GM_addStyle(`
        #bilibili-export-panel {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: linear-gradient(135deg, #f6f8fa, #e9ecef);
            border-radius: 24px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1), 0 1px 8px rgba(0,0,0,0.06);
            padding: 30px;
            width: 90%;
            max-width: 400px;
            max-height: 90vh;
            overflow-y: auto;
            display: none;
            z-index: 10000;
            font-family: 'Segoe UI', 'Roboto', sans-serif;
            transition: all 0.3s cubic-bezier(0.25,0.8,0.25,1);
            box-sizing: border-box !important;
            -webkit-box-sizing: border-box !important;
            -ms-overflow-style: none;
            scrollbar-width: none;
        }
        #bilibili-export-panel::-webkit-scrollbar {
            display: none;
        }
        #bilibili-export-panel * {
            box-sizing: border-box !important;
            -webkit-box-sizing: border-box !important;
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
            background-color: rgba(0,161,214,0.1);
            border-left: 4px solid #00a1d6;
            border-right: 4px solid #00a1d6;
            border-radius: 4px;
            font-size: 14px;
            color: #00a1d6;
            text-align: center;
            transition: all 0.5s ease;
        }
        #current-exporting.completed {
            background-color: rgba(76,175,80,0.1);
            border-left-color: #4CAF50;
            border-right-color: #4CAF50;
            color: #4CAF50;
        }
        @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.05); }
            100% { transform: scale(1); }
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
            overflow: hidden;
        }
        .formatButton {
            z-index: 2;
            padding: 10px 20px;
            font-size: 16px;
            color: #3c4043;
            cursor: pointer;
            transition: color 0.3s ease-in-out;
            font-weight: 600;
            flex: 1;
            text-align: center;
            position: relative;
            user-select: none;
        }
        .formatButton.selected { color: #FFF; }
        .slider {
            position: absolute;
            left: 5px;
            top: 5px;
            background-color: #00a1d6;
            border-radius: 15px;
            transition: transform 0.3s ease-in-out;
            height: calc(100% - 10px);
            width: calc(50% - 5px);
            z-index: 1;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            pointer-events: none;
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
        .toggle-switch:hover { background-color: #e8eaed; }
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
        .switch input { opacity: 0; width: 0; height: 0; }
        .switch-slider {
            position: absolute;
            cursor: pointer;
            top: 0; left: 0; right: 0; bottom: 0;
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
        input:checked + .switch-slider { background-color: #00a1d6; }
        input:checked + .switch-slider:before { transform: translateX(24px); }
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
            position: relative;
            overflow: hidden;
            min-height: 48px;
        }
        #export-button::after {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            height: 100%;
            width: var(--progress, 0%);
            background-color: rgba(0,0,0,0.1);
            transition: width 0.3s ease;
            z-index: 1;
            pointer-events: none;
        }
        #export-button.exporting {
            background-color: #e0e0e0;
            color: #333;
        }
        #export-button .progress-text {
            position: relative;
            z-index: 2;
        }
        #export-button:not(.exporting) {
            background-color: #00a1d6;
            color: white;
        }
        #export-button.exporting:hover {
            background-color: #ff4d4f;
            transform: translateY(-2px);
            box-shadow: 0 4px 8px rgba(255,77,79,0.3);
        }
        #export-button.exporting:hover .progress-text {
            opacity: 0;
        }
        #export-button.exporting:hover::before {
            content: '终止导出';
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            background-color: transparent;
            color: white;
            z-index: 3;
            transition: all 0.3s ease;
        }
        .input-group {
            margin-bottom: 15px;
            width: 100%;
        }
        .input-group input {
            width: 100%;
            padding: 10px;
            border: 1px solid #dadce0;
            border-radius: 8px;
            font-size: 14px;
            box-sizing: border-box !important;
            -webkit-box-sizing: border-box !important;
            margin: 0;
        }
        #speedSelector {
            display: flex;
            justify-content: center;
            align-items: center;
            margin-bottom: 25px;
            position: relative;
            background-color: #e0e0e0;
            border-radius: 20px;
            padding: 5px;
            box-shadow: inset 0 2px 4px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .speedButton {
            z-index: 2;
            padding: 10px 15px;
            font-size: 14px;
            color: #3c4043;
            cursor: pointer;
            transition: color 0.3s ease-in-out;
            font-weight: 600;
            flex: 1;
            text-align: center;
            position: relative;
            user-select: none;
        }
        .speedButton.selected { color: #FFF; }
        .speed-slider {
            position: absolute;
            left: 5px;
            top: 5px;
            background-color: #00a1d6;
            border-radius: 15px;
            transition: transform 0.3s ease-in-out;
            height: calc(100% - 10px);
            width: calc(33.33% - 5px);
            z-index: 1;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            pointer-events: none;
        }
        #panel-overlay {
            position: fixed;
            top: 0; left: 0;
            width: 100%; height: 100%;
            background-color: rgba(0,0,0,0.5);
            z-index: 9999;
            display: none;
        }
        #refresh-button {
            display: none;
            width: 100%;
            padding: 8px;
            background-color: #4CAF50;
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            font-weight: bold;
            cursor: pointer;
            transition: all 0.3s ease;
            margin-top: 10px;
            text-align: center;
            opacity: 0;
            transform: translateY(-10px);
        }
        #refresh-button.show {
            display: block;
            opacity: 1;
            transform: translateY(0);
        }
        #refresh-button:hover {
            background-color: #45a049;
            transform: translateY(-2px);
            box-shadow: 0 4px 8px rgba(76,175,80,0.3);
        }
        .title-mode-section {
            margin: 15px 0;
            padding: 15px;
            background-color: #f1f3f4;
            border-radius: 12px;
            transition: all 0.3s ease;
        }
        .title-mode-section:hover {
            background-color: #e8eaed;
        }
        .title-mode-header {
            font-size: 16px;
            color: #3c4043;
            font-weight: 600;
            margin-bottom: 15px;
        }
        .radio-group {
            display: flex;
            flex-direction: column;
            gap: 12px;
        }
        .radio-group label {
            display: flex;
            align-items: center;
            gap: 10px;
            cursor: pointer;
            font-size: 14px;
            color: #3c4043;
            padding: 8px 12px;
            border-radius: 8px;
            background-color: rgba(255,255,255,0.5);
            transition: all 0.2s ease;
        }
        .radio-group label:hover {
            background-color: rgba(255,255,255,0.8);
        }
        .radio-group input[type="radio"] {
            appearance: none;
            -webkit-appearance: none;
            width: 18px;
            height: 18px;
            border: 2px solid #00a1d6;
            border-radius: 50%;
            margin: 0;
            position: relative;
            transition: all 0.2s ease;
        }
        .radio-group input[type="radio"]:checked {
            background-color: #00a1d6;
            border-color: #00a1d6;
        }
        .radio-group input[type="radio"]:checked::after {
            content: '';
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background-color: white;
        }
        .inline-input {
            width: 40px;
            padding: 2px 4px;
            border: 1px solid #dadce0;
            border-radius: 4px;
            font-size: inherit;
            color: #3c4043;
            text-align: center;
            margin: 0 4px;
            display: inline-block;
            vertical-align: baseline;
        }
        .inline-input:focus {
            border-color: #00a1d6;
            outline: none;
            box-shadow: 0 0 0 2px rgba(0,161,214,0.2);
        }
        .repo-link {
            position: absolute;
            top: 20px;
            right: 20px;
            width: 24px;
            height: 24px;
            opacity: 0.7;
            transition: opacity 0.3s ease;
        }
        .repo-link:hover {
            opacity: 1;
        }
        .repo-link svg {
            width: 100%;
            height: 100%;
            fill: #00a1d6;
        }
    `);

    let panel = document.createElement('div');
    panel.id = 'bilibili-export-panel';
    panel.innerHTML = `
        <h2>图文收藏导出</h2>
        <a href="https://github.com/AHCorn/Bilibili-Favlist-Export" target="_blank" class="repo-link">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
        </a>
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
                <label for="include-content">包含内容</label>
                <label class="switch">
                    <input type="checkbox" id="include-content" checked>
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
            <label for="filter-invalid">过滤失效图文</label>
            <label class="switch">
                <input type="checkbox" id="filter-invalid" checked>
                <span class="switch-slider"></span>
            </label>
        </div>
        <div class="title-mode-section">
            <div class="title-mode-header">无标题动态处理方式</div>
            <div class="radio-group">
                <label>
                    <input type="radio" name="title-mode" value="dynamic" checked>
                    <span>统一使用"动态"作为标题</span>
                </label>
                <label>
                    <input type="radio" name="title-mode" value="content">
                    <span>使用动态内容前<input type="number" id="title-length" class="inline-input" min="1" max="100" value="20">个字符作为标题</span>
                </label>
            </div>
        </div>
        <div id="speedSelector">
            <div class="speed-slider"></div>
            <div class="speedButton" data-speed="slow">慢速</div>
            <div class="speedButton" data-speed="normal">正常</div>
            <div class="speedButton" data-speed="fast">快速</div>
        </div>
        <div class="button-container">
            <button id="export-button">开始导出</button>
            <button id="refresh-button">刷新后继续导出</button>
        </div>
    `;

    let overlay = document.createElement("div");
    overlay.id = "panel-overlay";
    document.body.appendChild(overlay);
    document.body.appendChild(panel);

    let exportButton = panel.querySelector('#export-button');
    let formatButtons = panel.querySelectorAll('.formatButton');
    let bookmarkTitleInput = panel.querySelector('#bookmark-title');
    let globalFolderNameInput = panel.querySelector('#global-folder-name');
    let refreshButton = panel.querySelector('#refresh-button');

    formatButtons.forEach(button => {
        button.addEventListener('click', function() {
            const newFormat = this.dataset.format;
            if (newFormat !== exportFormat) {
                exportFormat = newFormat;
                GM_setValue('exportFormat', exportFormat);
                updateFormatButtons();
            }
        });
    });

    function updateFormatButtons() {
        formatButtons.forEach(button => {
            button.classList.toggle('selected', button.dataset.format === exportFormat);
        });
        const slider = panel.querySelector('.slider');
        slider.style.transform = exportFormat === 'csv' ? 'translateX(0)' : 'translateX(100%)';
        toggleOptions();
    }

    function toggleOptions() {
        const csvOptions = panel.querySelector('#csv-options');
        const htmlOptions = panel.querySelector('#html-options');

        if (exportFormat === 'csv') {
            csvOptions.style.display = 'block';
            htmlOptions.style.display = 'none';
        } else {
            csvOptions.style.display = 'none';
            htmlOptions.style.display = 'block';
        }
    }

    ['title', 'url', 'content', 'created'].forEach(option => {
        panel.querySelector(`#include-${option}`).addEventListener('change', (e) => {
            csvInclude[option] = e.target.checked;
            GM_setValue(`include_${option}`, csvInclude[option]);
            updateCSVHeader();
        });
    });

    const speedButtons = panel.querySelectorAll('.speedButton');
    speedButtons.forEach(button => {
        button.addEventListener('click', function() {
            const newSpeed = this.dataset.speed;
            const newDelay = DELAY_SPEEDS[newSpeed];
            if (newDelay !== DELAY) {
                if (newSpeed === 'fast') {
                    if (confirm('快速导出（1000ms）可能会因为页面加载速度不够导致链接错位，是否继续？')) {
                        DELAY = newDelay;
                        GM_setValue('exportDelay', DELAY);
                        updateSpeedButtons();
                    }
                } else {
                    DELAY = newDelay;
                    GM_setValue('exportDelay', DELAY);
                    updateSpeedButtons();
                }
            }
        });
    });

    function updateSpeedButtons() {
        const currentSpeed = Object.entries(DELAY_SPEEDS).find(([_, value]) => value === DELAY)?.[0] || 'normal';
        const slider = panel.querySelector('.speed-slider');

        speedButtons.forEach(button => {
            button.classList.toggle('selected', button.dataset.speed === currentSpeed);
        });

        switch(currentSpeed) {
            case 'slow':
                slider.style.transform = 'translateX(0)';
                break;
            case 'normal':
                slider.style.transform = 'translateX(100%)';
                break;
            case 'fast':
                slider.style.transform = 'translateX(200%)';
                break;
        }
    }

    function loadSavedSettings() {
        ['title', 'url', 'content', 'created'].forEach(option => {
            const saved = GM_getValue(`include_${option}`);
            if (saved !== undefined) {
                csvInclude[option] = saved;
                panel.querySelector(`#include-${option}`).checked = saved;
            }
        });
        updateCSVHeader();

        bookmarkTitleInput.value = GM_getValue('bookmarkTitle', '');
        globalFolderNameInput.value = GM_getValue('globalFolderName', '');
        DELAY = GM_getValue('exportDelay', DELAY_SPEEDS.normal);
        updateSpeedButtons();
        updateFormatButtons();

        const filterInvalidCheckbox = panel.querySelector('#filter-invalid');
        filterInvalidCheckbox.checked = GM_getValue('filterInvalidArticles', true);

        const titleModeRadios = panel.querySelectorAll('input[name="title-mode"]');
        const savedTitleMode = GM_getValue('titleMode', 'dynamic');
        titleModeRadios.forEach(radio => {
            if (radio.value === savedTitleMode) {
                radio.checked = true;
            }
        });

        const titleLengthInput = panel.querySelector('#title-length');
        titleLengthInput.value = GM_getValue('titleLength', 20);
    }

    function showPanel() {
        panel.style.opacity = 0;
        panel.style.display = 'block';
        overlay.style.display = 'block';
        setTimeout(() => { panel.style.opacity = 1; }, 0);

        if (hasExportedData) {
            exportButton.innerHTML = "立即下载";
            document.querySelector('#current-exporting').textContent = "导出完成";
            refreshButton.classList.add('show');
        } else {
            exportButton.innerHTML = "开始导出";
            document.querySelector('#current-exporting').textContent = "点击下方按钮开始导出";
            refreshButton.classList.remove('show');
        }
    }

    function hidePanel() {
        panel.style.opacity = 0;
        overlay.style.display = 'none';
        setTimeout(() => { panel.style.display = 'none'; }, 300);
    }

    overlay.addEventListener('click', hidePanel);
    exportButton.onclick = startExport;
    refreshButton.onclick = () => { location.reload(); };

    panel.querySelector('#filter-invalid').addEventListener('change', (e) => {
        filterInvalidArticles = e.target.checked;
        GM_setValue('filterInvalidArticles', filterInvalidArticles);
    });

    panel.querySelectorAll('input[name="title-mode"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            titleMode = e.target.value;
            GM_setValue('titleMode', titleMode);
        });
    });

    panel.querySelector('#title-length').addEventListener('change', (e) => {
        titleLength = parseInt(e.target.value) || 20;
        if (titleLength < 1) titleLength = 1;
        if (titleLength > 100) titleLength = 100;
        e.target.value = titleLength;
        GM_setValue('titleLength', titleLength);
    });

    bookmarkTitleInput.addEventListener('change', (e) => {
        GM_setValue('bookmarkTitle', e.target.value);
    });

    globalFolderNameInput.addEventListener('change', (e) => {
        GM_setValue('globalFolderName', e.target.value);
    });

    loadSavedSettings();
    GM_registerMenuCommand("导出图文收藏", showPanel);
})();
