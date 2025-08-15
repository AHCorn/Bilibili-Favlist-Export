// ==UserScript==
// @name         哔哩哔哩收藏夹导出
// @namespace    https://github.com/AHCorn/Bilibili-Favlist-Export
// @icon         https://www.bilibili.com/favicon.ico
// @version      3.2
// @license      GPL-3.0
// @description  导出哔哩哔哩收藏夹为 CSV 或 HTML 文件，以便导入 Raindrop 或 Firefox。
// @author       AHCorn
// @match        http*://space.bilibili.com/*/*
// @grant        GM_addStyle
// @grant        GM_download
// @grant        GM_registerMenuCommand
// @grant        GM_setValue
// @grant        GM_getValue
// @require      https://cdn.jsdelivr.net/npm/jquery@3.7.1/dist/jquery.min.js
// @updateURL    https://github.com/AHCorn/Bilibili-Favlist-Export/raw/main/Bilibili-Favlist-Export.user.js
// @downloadURL  https://github.com/AHCorn/Bilibili-Favlist-Export/raw/main/Bilibili-Favlist-Export.user.js
// ==/UserScript==

(function () {
    'use strict';
    // 要改导出速度可以在下方更改（单位ms）
    let DELAY = GM_getValue('exportDelay', 2000);
    const DELAY_SPEEDS = {
        slow: 4000,
        normal: 2000,
        fast: 1000
    };
    let filterInvalidVideos = GM_getValue('filterInvalidVideos', true);
    let csvHeaderOptions = {
        title: "\uFEFFtitle",
        url: "url",
        foldername: "folder",
        created: "created",
        uploader: "uploader",
        mid: "mid",
        views: "views"
    };
    let csvHeaderActive = ["\uFEFFtitle", "url", "folder", "created"];
    function updateCSVHeader() {
        csvHeaderActive = Object.keys(csvHeaderOptions)
            .filter(option => csvInclude[option])
            .map(option => csvHeaderOptions[option]);
    }
    let csvContent = csvHeaderActive.join(",") + "\n";
    let htmlTemplateStart = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>{BOOKMARK_TITLE}</H1>
<DL><p>
<DT><H3 ADD_DATE="{dateNow}" LAST_MODIFIED="{dateNow}">{globalFolderName}</H3>
<DL><p>`;
    const HTML_TEMPLATE_END = `</DL><p>
</DL><p>`;
    let htmlContent = "";
    let csvInclude = {
        title: true,
        url: true,
        foldername: true,
        created: true,
        uploader: false,
        mid: false,
        views: false
    };
    let exportCurrentFolderOnly = false;
    let currentFolderName = "";
    let addedFolders = new Set();

    GM_addStyle(`
        #bilibili-export-panel {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: linear-gradient(135deg, #f6f8fa, #e9ecef);
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.12), 0 8px 20px rgba(0,0,0,0.08);
            padding: 32px;
            width: 95%;
            max-width: 580px;
            max-height: 85vh;
            overflow-y: auto;
            display: none;
            z-index: 10000;
            font-family: 'SF Pro Display', 'Segoe UI', 'Roboto', sans-serif;
            transition: all 0.3s cubic-bezier(0.25,0.8,0.25,1), height 0.4s ease-out;
            box-sizing: border-box !important;
            -webkit-box-sizing: border-box !important;
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
            padding: 14px 16px;
            background: linear-gradient(135deg, rgba(0,161,214,0.08), rgba(0,161,214,0.04));
            border: 1px solid rgba(0,161,214,0.2);
            border-radius: 12px;
            font-size: 15px;
            font-weight: 600;
            color: #00a1d6;
            text-align: center;
            transition: all 0.5s cubic-bezier(0.25,0.8,0.25,1);
        }
        #current-exporting.completed {
            background: linear-gradient(135deg, rgba(76,175,80,0.08), rgba(76,175,80,0.04));
            border-color: rgba(76,175,80,0.3);
            color: #2e7d32;
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
        .csv-options-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
            gap: 12px;
            margin-bottom: 20px;
        }
        @media (max-width: 600px) {
            .csv-options-grid {
                grid-template-columns: 1fr;
            }
            #bilibili-export-panel {
                width: 95%;
                max-width: none;
                padding: 24px;
            }
        }
        .option-card {
            position: relative;
            padding: 16px;
            background: #ffffff;
            border: 2px solid #e5e7eb;
            border-radius: 16px;
            cursor: pointer;
            transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
            user-select: none;
        }
        .option-card:hover {
            border-color: #00a1d6;
            box-shadow: 0 4px 16px rgba(0, 161, 214, 0.1);
            transform: translateY(-1px);
        }
        .option-card.selected {
            border-color: #00a1d6;
            background: linear-gradient(135deg, rgba(0, 161, 214, 0.05), rgba(0, 161, 214, 0.02));
        }
        .option-card.selected::after {
            content: '✓';
            position: absolute;
            top: 12px;
            right: 12px;
            width: 20px;
            height: 20px;
            background: #00a1d6;
            color: white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: bold;
        }
        .option-title {
            font-size: 15px;
            font-weight: 600;
            color: #1f2937;
            margin-bottom: 4px;
        }
        .option-desc {
            font-size: 13px;
            color: #6b7280;
            line-height: 1.4;
        }
        .option-card.disabled {
            border-color: #ef4444;
            background: rgba(239, 68, 68, 0.05);
            cursor: not-allowed;
        }
        .option-card.disabled:hover {
            border-color: #ef4444;
            box-shadow: none;
            transform: none;
        }
        .option-card.disabled .option-title {
            color: #dc2626;
        }
        .option-card.disabled .option-desc {
            color: #b91c1c;
        }
        .select-all-card {
            position: relative;
            padding: 16px;
            background: linear-gradient(135deg, #00a1d6, #0086b3);
            border: 2px solid #00a1d6;
            border-radius: 16px;
            cursor: pointer;
            transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
            user-select: none;
            color: white;
            text-align: center;
        }
        .select-all-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(0, 161, 214, 0.3);
            background: linear-gradient(135deg, #0086b3, #006d94);
        }
        .select-all-card .option-title {
            color: white;
            margin-bottom: 4px;
            font-size: 15px;
            font-weight: 600;
        }
        .select-all-card .option-desc {
            color: rgba(255, 255, 255, 0.9);
            font-size: 13px;
        }
        .toggle-switch {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 12px;
            padding: 12px 16px;
            background-color: #f8fafc;
            border-radius: 12px;
            transition: all 0.3s ease;
            border: 1px solid #e2e8f0;
        }
        .toggle-switch:hover {
            background-color: #f1f5f9;
            border-color: #cbd5e1;
        }
        .toggle-switch label {
            font-size: 15px;
            color: #334155;
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
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideIn { from { transform: translate(-50%, -60%); } to { transform: translate(-50%, -50%); } }
        #bilibili-export-panel.show {
            display: block;
            animation: fadeIn 0.3s ease-out, slideIn 0.3s ease-out;
        }
        #panel-overlay {
            position: fixed;
            top: 0; left: 0;
            width: 100%; height: 100%;
            background-color: rgba(0,0,0,0.5);
            z-index: 9999;
            display: none;
        }
        #current-exporting.completed {
            cursor: help;
        }
        #current-exporting[title] {
            text-decoration: underline dotted;
        }
        #refresh-button {
            display: none;
            width: 100%;
            padding: 12px;
            background: #f8f9fa;
            color: #495057;
            border: 1px solid #dee2e6;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: background 0.2s ease, border-color 0.2s ease, transform 0.2s ease;
            margin-top: 12px;
            text-align: center;
            opacity: 0;
            max-height: 0;
            overflow: hidden;
            transform: translateY(-10px);
        }
        #refresh-button.show {
            display: block;
            opacity: 1;
            max-height: 60px;
            transform: translateY(0);
            animation: refreshButtonSlideIn 0.5s ease-out;
        }
        @keyframes refreshButtonSlideIn {
            0% {
                opacity: 0;
                max-height: 0;
                transform: translateY(-10px) scale(0.95);
                margin-top: 0;
            }
            50% {
                max-height: 60px;
                margin-top: 12px;
            }
            100% {
                opacity: 1;
                max-height: 60px;
                transform: translateY(0) scale(1);
                margin-top: 12px;
            }
        }
        #refresh-button:hover {
            background: #e9ecef;
            border-color: #adb5bd;
            transform: translateY(-1px);
        }
        #refresh-button:active {
            background: #dee2e6;
            transform: translateY(0);
        }
        .button-container {
            display: flex;
            flex-direction: column;
            gap: 10px;
            margin-top: 20px;
            transition: height 0.4s ease-out;
            overflow: hidden;
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
        .github-link {
            position: absolute;
            top: 20px;
            right: 20px;
            width: 24px;
            height: 24px;
            opacity: 0.7;
            transition: opacity 0.3s ease;
        }
        .github-link:hover {
            opacity: 1;
        }
        .github-link svg {
            width: 100%;
            height: 100%;
            fill: #00a1d6;
        }
    `);


    function* listGen() {
        // 新版
        if ($(".favlist-aside").length > 0) {
            let groups = $(".favlist-aside .fav-collapse");
            let group = groups.filter(function() {
                let headerText = $(this).find(".vui_collapse_item_header").first().text().trim();
                return headerText.indexOf("我创建的收藏夹") !== -1;
            }).first();
            if (group.length > 0) {
                let favorites = group.find(".fav-sidebar-item");
                for (let item of favorites.get()) {
                    yield item;
                }
                return;
            }
        }

        // 旧版
        if ($("#fav-createdList-container").length > 0) {
            let defaultFolder = $("#fav-createdList-container > .fav-item.cur");
            if (defaultFolder.length > 0) {
                yield defaultFolder[0];
            }

            let folders = $("#fav-createdList-container > ul.fav-list > li.fav-item");
            for (let folder of folders.get()) {
                yield folder;
            }
            return;
        }

        if ($(".fav-list").length > 0) {
            let folders = $(".fav-list .fav-item").get();
            for (let folder of folders) {
                yield folder;
            }
        } else if ($(".favlist-aside .fav-sidebar-item").length > 0) {
            let folders = $(".favlist-aside .fav-sidebar-item").get();
            for (let folder of folders) {
                yield folder;
            }
        } else if ($(".fav-sortable-list .fav-sidebar-item").length > 0) {
            let folders = $(".fav-sortable-list .fav-sidebar-item").get();
            for (let folder of folders) {
                yield folder;
            }
        }
    }

    let gen = listGen();
    let panel = null;
    let exportButton = null;
    let formatButtons = null;
    let bookmarkTitleInput = null;
    let globalFolderNameInput = null;
    let totalPage = 0;
    let currentPage = 0;
    let isExporting = false;
    let hasExportedData = false;
    let exportFormat = GM_getValue('exportFormat', 'csv');
    let exportedData = {
        csv: null,
        html: null,
        htmlConfig: {
            title: '',
            globalFolderName: ''
        },
        errors: []
    };

    // 公共函数：判断是否为新版页面
    function isNewVersionPage() {
        return $('.items').length > 0;
    }

    // 更新卡片状态（禁用样式）
    function updateCardStates() {
        if (!panel) return;

        const extras = ['uploader', 'mid', 'views'];
        const isCSV = exportFormat === 'csv';
        const isNewPage = isNewVersionPage();

        extras.forEach(option => {
            const card = panel.querySelector(`[data-option="${option}"]`);
            if (card) {
                const shouldDisable = !isCSV || !isNewPage;
                card.classList.toggle('disabled', shouldDisable);
            }
        });
    }

    function getCSVFileName() {
        let userName = "";
        if ($(".nickname").length > 0) {
            userName = $(".nickname").first().text().trim();
        } else {
            userName = $("#h-name").text().trim();
        }
        if (exportCurrentFolderOnly) {
            // 文件名优化
            let folderName = currentFolderName || getFolderName() || getFolderNameFromSidebar() || "";
            return userName + "的" + folderName + "收藏.csv";
        } else {
            return userName + "的收藏夹.csv";
        }
    }
    function getHTMLFileName() {
        let userName = "";
        if ($(".nickname").length > 0) {
            userName = $(".nickname").first().text().trim();
        } else {
            userName = $("#h-name").text().trim();
        }
        if (exportCurrentFolderOnly) {
            let folderName = currentFolderName || getFolderName() || getFolderNameFromSidebar() || "";
            return userName + "的" + folderName + "收藏.html";
        } else {
            return userName + "的收藏夹.html";
        }
    }

    function getFolderName() {
        let folderName = "";
        // 新版
        if ($(".favlist-info-detail__title .vui_ellipsis.multi-mode").length > 0) {
            folderName = $(".favlist-info-detail__title .vui_ellipsis.multi-mode").first().text().trim();
        }
        // 旧版
        else if ($(".fav-name").length > 0) {
            folderName = $(".fav-name").first().text().trim();
        }
        // 兜底
        else if ($("#fav-createdList-container").length > 0) {
            folderName = $("#fav-createdList-container .fav-item.cur a.text").text().trim();
        }
        return folderName || "未知收藏夹";
    }

    function getFolderNameFromSidebar() {
        let selected = $(".fav-sidebar-item.vui_sidebar-item--active").first();
        if (selected.length > 0) {
            let folder = selected.find(".vui_ellipsis").first().text().trim();
            if (!folder) {
                folder = selected.text().trim();
            }
            return folder;
        }
        return "";
    }

    // 去掉 URL 中查询参数
    function getVideosFromPage() {
        var results = [];
        var folderName = currentFolderName.replace(/\//g, '\\');

        // 新版
        if ($(".items").length > 0) {
            $(".items__item").each(function () {
                var title = $(this).find(".bili-video-card__title a").text().trim();
                if (!title) return;
                if (filterInvalidVideos && (title === "已失效视频" || title.includes("视频不见了"))) {
                    return;
                }
                var url = $(this).find(".bili-video-card__cover a").attr("href");
                if (url) {
                    if (url.indexOf("http") !== 0) {
                        url = "https:" + url;
                    }
                    url = url.split('?')[0];
                }
                var pubText = $(this).find(".bili-video-card__subtitle a .bili-video-card__text span").attr("title") || "";
                var created = "";
                var match = pubText.match(/收藏于((?:\d{4}[\/-])?\d{1,2}[\/-]\d{1,2})/);
                if(match) {
                    created = parseTime(match[1]);
                } else {
                    var textContent = $(this).find(".bili-video-card__subtitle").text().trim();
                    var m2 = textContent.match(/收藏于((?:\d{4}[\/-])?\d{1,2}[\/-]\d{1,2})/);
                    created = m2 ? parseTime(m2[1]) : "";
                }
                // 可选：昵称、MID、播放量（新版）
                var uploaderName = "";
                if (pubText) {
                    uploaderName = pubText.split('·')[0].trim();
                } else {
                    var subText = $(this).find(".bili-video-card__subtitle").text().trim();
                    uploaderName = subText.split('·')[0].trim();
                }
                var uploaderId = "";
                var authorHref = $(this).find(".bili-video-card__subtitle a.bili-video-card__author").attr("href") || "";
                if (authorHref) {
                    var idMatch = authorHref.match(/space\.bilibili\.com\/(\d+)/);
                    uploaderId = idMatch ? idMatch[1] : "";
                }
                var playCount = $(this).find(".bili-cover-card__stats .bili-cover-card__stat").first().find("span").text().trim() || "";
                results.push(generateCSVLine(folderName, title, url, created, uploaderName, uploaderId, playCount));
                addHTMLBookmark(folderName, title, url, created);
            });
        }
        else if ($(".fav-video-list").length > 0) {
            $(".fav-video-list > li").each(function () {
                var titleElement = $(this).find("a.title");
                var title = titleElement.text().trim();
                if (!title) return;
                if (filterInvalidVideos && (title === "已失效视频" || title.includes("视频不见了"))) {
                    return;
                }
                var url = titleElement.attr("href");
                if (url) {
                    if (url.indexOf("http") !== 0) {
                        url = "https:" + url;
                    }
                    url = url.split('?')[0];
                }
                var timeElement = $(this).find(".meta.pubdate");
                var timeText = timeElement.text().trim().replace("收藏于：", "").trim();
                var created = parseTime(timeText);
                // 旧版不支持新增字段
                results.push(generateCSVLine(folderName, title, url, created, "", "", ""));
                addHTMLBookmark(folderName, title, url, created);
            });
        }
        return results.join('\n');
    }

    function escapeCSV(field) {
        return '"' + String(field).replace(/"/g, '""') + '"';
    }

    function getCurrentTimestamp() {
        return Math.floor(Date.now() / 1000);
    }

    function addHTMLFolder(folderName) {
        if (addedFolders.has(folderName)) {
            htmlContent += `</DL><p>\n`;
            return;
        }

        if (addedFolders.size > 0) {
            htmlContent += `</DL><p>\n`;
        }

        addedFolders.add(folderName);
        // 获取当前时间戳
        let dateNow = getCurrentTimestamp();
        htmlContent += `<DT><H3 ADD_DATE="${dateNow}" LAST_MODIFIED="${dateNow}">${folderName}</H3>\n<DL><p>\n`;
    }

    function addHTMLBookmark(folderName, title, url, created) {
        if (!addedFolders.has(folderName) || addedFolders.size === 0) {
            addHTMLFolder(folderName);
        } else if (Array.from(addedFolders).pop() !== folderName) {
            addHTMLFolder(folderName);
        }

        // 创建时间转换为时间戳
        let timestamp;
        if (created) {
            timestamp = Math.floor(new Date(created).getTime() / 1000);
        } else {
            timestamp = getCurrentTimestamp();
        }

        htmlContent += `<DT><A HREF="${url}" ADD_DATE="${timestamp}" LAST_MODIFIED="${timestamp}">${title}</A>\n`;
    }

    function generateCSVLine(folderName, title, url, created, uploaderName, uploaderId, playCount) {
        let parts = [];
        if (csvInclude.title) parts.push(escapeCSV(title));
        if (csvInclude.url) parts.push(escapeCSV(url));
        if (csvInclude.foldername) parts.push(escapeCSV(folderName));
        if (csvInclude.created) parts.push(escapeCSV(created));
        if (csvInclude.uploader) parts.push(escapeCSV(uploaderName || ""));
        if (csvInclude.mid) parts.push(escapeCSV(uploaderId || ""));
        if (csvInclude.views) parts.push(escapeCSV(playCount || ""));
        return parts.join(',');
    }


    function parseTime(timeText) {
        timeText = timeText.replace(/^收藏于/, '').trim();
        if (timeText.indexOf("年") > -1) {
            timeText = timeText.replace("年", "-")
                               .replace("月", "-")
                               .replace("日", "")
                               .trim();
        }
        let now = new Date();
        let currentYear = now.getFullYear();
        if (timeText.match(/^\d{1,2}-\d{1,2}$/)) {
            let [month, day] = timeText.split('-').map(Number);
            return `${currentYear}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        } else if (timeText.match(/^\d{4}[\/-]\d{1,2}[\/-]\d{1,2}$/)) {
            let delimiter = timeText.indexOf('/') > -1 ? '/' : '-';
            let parts = timeText.split(delimiter);
            let year = parts[0];
            let month = parts[1].padStart(2, '0');
            let day = parts[2].padStart(2, '0');
            return `${year}-${month}-${day}`;
        } else if (timeText === "昨天") {
            let yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            return yesterday.toISOString().split('T')[0];
        } else if (timeText.includes("年前") || timeText.includes("月前") || timeText.includes("天前") ||
                   timeText.includes("小时前") || timeText.includes("分钟前")) {
            let time;
            if (timeText.includes("年前")) {
                let years = parseInt(timeText);
                time = new Date(now.getFullYear() - years, now.getMonth(), now.getDate());
            } else if (timeText.includes("月前")) {
                let months = parseInt(timeText);
                time = new Date(now.getFullYear(), now.getMonth() - months, now.getDate());
            } else if (timeText.includes("天前")) {
                let days = parseInt(timeText);
                time = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
            } else if (timeText.includes("小时前")) {
                let hours = parseInt(timeText);
                time = new Date(now.getTime() - hours * 60 * 60 * 1000);
            } else if (timeText.includes("分钟前")) {
                let minutes = parseInt(timeText);
                time = new Date(now.getTime() - minutes * 60 * 1000);
            }
            return time.toISOString().split('T')[0];
        } else {
            return timeText;
        }
    }

    // 遍历当前收藏夹
    async function processVideos() {
        if (isExporting) {
            let retryCount = 0;
            let videosLine = "";

            while (retryCount < 2) {
                videosLine = getVideosFromPage();

                if (videosLine.length === 0) {
                    if (retryCount === 0) {
                        document.querySelector('#current-exporting').textContent = `正在导出：${currentFolderName}（内容为空，等待重试...）`;
                        await new Promise(resolve => setTimeout(resolve, 3000));
                        retryCount++;
                        continue;
                    } else {
                        exportedData.errors.push({
                            folder: currentFolderName,
                            page: currentPage + 1,
                            message: "页面内容为空"
                        });
                        document.querySelector('#current-exporting').textContent =
                            `正在导出：${currentFolderName}（警告：第${currentPage + 1}页内容为空）`;
                    }
                }
                break;
            }

            csvContent += videosLine + '\n';
            currentPage++;
            updateProgress(Math.round((currentPage / totalPage) * 100));

            // 检查新版 / 旧版的下一页
            let hasOldNext = $(".be-pager-next:visible").length > 0;
            let hasNewNext = $(".vui_pagenation .vui_pagenation--btn-side:contains('下一页'):visible").length > 0;

            if (currentPage >= totalPage || (!hasOldNext && !hasNewNext)) {
                if (exportCurrentFolderOnly) {
                    finishExport();
                } else {
                    setTimeout(changeList, DELAY);
                }
            } else {
                if (hasOldNext) {
                    $(".be-pager-next").click();
                } else if (hasNewNext) {
                    $(".vui_pagenation .vui_pagenation--btn-side:contains('下一页')").click();
                }
                setTimeout(processVideos, DELAY);
            }
        }
    }

    function changeList() {
        if (isExporting) {
            if (exportCurrentFolderOnly) {
                processVideos();
            } else {
                let list = gen.next().value;
                if (list) {
                    let folderTitle = "";
                    if ($("#fav-createdList-container").length > 0) {
                        // 区分默认
                        if ($(list).hasClass("cur")) {
                            folderTitle = $(list).find("a.text").text().trim();
                        } else {
                            folderTitle = $(list).find("a.text").text().trim();
                            $(list).find("a.text")[0].click();
                        }
                    }
                    // 新
                    else {
                        folderTitle = $(list).attr("title") ||
                                    $(list).find(".vui_ellipsis").first().text().trim() ||
                                    $(list).text().trim();
                        if ($(list).find(".vui_sidebar-item").length > 0) {
                            $(list).find(".vui_sidebar-item").click();
                        } else {
                            $(list).click();
                        }
                    }

                    currentFolderName = folderTitle || getFolderName() || getFolderNameFromSidebar() || "未知收藏夹";
                    setTimeout(() => {
                        if ($(".be-pager-total").length > 0) {
                            totalPage = parseInt($(".be-pager-total").text().match(/\d+/)[0]) || 1;
                        } else if ($(".vui_pagenation-go__count").length > 0) {
                            let text = $(".vui_pagenation-go__count").text();
                            let match = text.match(/共\s*(\d+)\s*页/);
                            totalPage = match ? parseInt(match[1]) : 1;
                        } else {
                            totalPage = 1;
                        }
                        currentPage = 0;
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
        exportButton.innerHTML = `<span class="progress-text">导出中... ${percentage}%</span>`;
        exportButton.style.setProperty('--progress', `${percentage}%`);
        exportButton.classList.add('exporting');
    }

    function updateHTMLConfig() {
        exportedData.htmlConfig = {
            title: bookmarkTitleInput.value.trim(),
            globalFolderName: globalFolderNameInput.value.trim()
        };
        if (exportedData.html) {
            exportedData.html = htmlTemplateStart
                .replace("{globalFolderName}", exportedData.htmlConfig.globalFolderName)
                .replace("{BOOKMARK_TITLE}", exportedData.htmlConfig.title)
                .replace("{dateNow}", getCurrentTimestamp()) +
                htmlContent + HTML_TEMPLATE_END;
        }
    }

    function startExport() {
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

        exportedData.htmlConfig = {
            title: bookmarkTitleInput.value.trim(),
            globalFolderName: globalFolderNameInput.value.trim()
        };

        exportedData.errors = [];
        htmlContent = "";
        addedFolders = new Set();
        csvContent = "\uFEFF" + csvHeaderActive.join(",") + "\n";

        GM_setValue('bookmarkTitle', bookmarkTitleInput.value);
        GM_setValue('globalFolderName', globalFolderNameInput.value);
        exportButton.disabled = false;
        exportButton.style.cursor = 'pointer';
        exportButton.innerHTML = "导出中... 0%";
        isExporting = true;
        document.querySelector('#current-exporting').textContent = "准备开始导出...";
        document.querySelector('#current-exporting').classList.remove('completed');
        exportButton.classList.add('exporting');

        exportButton.onclick = () => {
            if (confirm('确定要终止导出吗？')) {
                isExporting = false;
                finishExport(true);
            }
        };

        if (exportCurrentFolderOnly) {
            currentFolderName = getFolderName() || getFolderNameFromSidebar() || "未知收藏夹";
            if ($(".be-pager-total").length > 0) {
                totalPage = parseInt($(".be-pager-total").text().match(/\d+/)[0]) || 1;
            } else if ($(".vui_pagenation-go__count").length > 0) {
                let text = $(".vui_pagenation-go__count").text();
                let match = text.match(/共\s*(\d+)\s*页/);
                totalPage = match ? parseInt(match[1]) : 1;
            } else {
                totalPage = 1;
            }
            currentPage = 0;
            document.querySelector('#current-exporting').textContent = `正在导出：${currentFolderName}`; // 更新状态提示
            processVideos();
        } else {
            gen = listGen();
            changeList();
        }
    }

    function finishExport(isTerminated = false) {
        isExporting = false;
        exportButton.disabled = false;
        exportButton.style.cursor = 'pointer';
        exportButton.classList.remove('exporting');
        exportButton.style.setProperty('--progress', '0%');
        let currentExporting = document.querySelector('#current-exporting');

        if (!isTerminated) {
            if (addedFolders.size > 0) {
                htmlContent += `</DL><p>\n`;
            }

            exportedData.csv = csvContent;
            exportedData.html = htmlTemplateStart
                .replace("{globalFolderName}", exportedData.htmlConfig.globalFolderName)
                .replace("{BOOKMARK_TITLE}", exportedData.htmlConfig.title)
                .replace("{dateNow}", getCurrentTimestamp()) +
                htmlContent + HTML_TEMPLATE_END;

            hasExportedData = true;
            exportButton.innerHTML = `<span class="progress-text">立即下载</span>`;

            if (exportedData.errors.length > 0) {
                let errorMsg = "导出完成，但存在以下异常：\n";
                exportedData.errors.forEach(error => {
                    errorMsg += `${error.folder}（第${error.page}页）: ${error.message}\n`;
                });
                currentExporting.textContent = "导出完成（存在异常）";
                currentExporting.title = errorMsg;
            } else {
                currentExporting.textContent = "导出完成";
            }

            const refreshButton = document.querySelector('#refresh-button');
            refreshButton.classList.add('show');
            refreshButton.onclick = () => {
                location.reload();
            };

            exportButton.onclick = () => {
                if (exportFormat === "csv") {
                    downloadCSV();
                } else if (exportFormat === "html") {
                    if (!bookmarkTitleInput.value || !globalFolderNameInput.value) {
                        alert("请配置书签标题和全局父文件夹名称。");
                        return;
                    }
                    downloadHTML();
                }
            };
        } else {
            if (csvContent.length > csvHeaderActive.join(",").length + 2) {
                exportedData.csv = csvContent;
                exportedData.html = htmlTemplateStart
                    .replace("{globalFolderName}", exportedData.htmlConfig.globalFolderName)
                    .replace("{BOOKMARK_TITLE}", exportedData.htmlConfig.title)
                    .replace("{dateNow}", getCurrentTimestamp()) +
                    htmlContent + HTML_TEMPLATE_END;
                hasExportedData = true;
                exportButton.innerHTML = "立即下载";
                currentExporting.textContent = "导出已终止（可下载已导出内容）";

                const refreshButton = document.querySelector('#refresh-button');
                refreshButton.classList.add('show');
                refreshButton.onclick = () => {
                    location.reload();
                };

                exportButton.onclick = () => {
                    if (exportFormat === "csv") {
                        downloadCSV();
                    } else if (exportFormat === "html") {
                        if (!bookmarkTitleInput.value || !globalFolderNameInput.value) {
                            alert("请配置书签标题和全局父文件夹名称。");
                            return;
                        }
                        downloadHTML();
                    }
                };
            } else {
                exportButton.innerHTML = "开始导出";
                currentExporting.textContent = "导出已终止";
                exportedData.csv = null;
                exportedData.html = null;
                exportedData.errors = [];
                hasExportedData = false;
                document.querySelector('#refresh-button').classList.remove('show');
                exportButton.onclick = startExport;
            }
        }
        currentExporting.classList.add('completed');
    }

    function downloadCSV() {
        if (!exportedData.csv) {
            alert('没有可用的导出数据，请先执行导出操作。');
            return;
        }
        let fileName = getCSVFileName();
        let blobUrl = URL.createObjectURL(new Blob([exportedData.csv], {type: 'text/csv;charset=utf-8;'}));
        GM_download({
            url: blobUrl,
            name: fileName,
            onload: () => {},
            onerror: () => {
                alert('下载失败，正在尝试弹出新标签页进行下载，请允许弹窗权限');
                let htmlContent = `
<html>
<head><meta charset="UTF-8"></head>
<body><a href="${blobUrl}" download="${fileName}">点击下载 CSV 文件</a></body>
</html>`;
                let htmlBlob = new Blob([htmlContent], {type: 'text/html;charset=utf-8;'});
                let htmlBlobUrl = URL.createObjectURL(htmlBlob);
                window.open(htmlBlobUrl, '_blank');
            }
        });
    }

    function downloadHTML() {
        if (!exportedData.html) {
            alert('没有可用的导出数据，请先执行导出操作。');
            return;
        }
        let fileName = getHTMLFileName();
        let blobUrl = URL.createObjectURL(new Blob([exportedData.html], {type: 'text/html;charset=utf-8;'}));
        GM_download({
            url: blobUrl,
            name: fileName,
            onload: () => {},
            onerror: () => {
                alert('下载失败，正在尝试弹出新标签页进行下载，请允许弹窗权限');
                let htmlContent = `
<html>
<head><meta charset="UTF-8"></head>
<body><a href="${blobUrl}" download="${fileName}">点击下载 HTML 文件</a></body>
</html>`;
                let htmlBlob = new Blob([htmlContent], {type: 'text/html;charset=utf-8;'});
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
        <a href="https://github.com/AHCorn/Bilibili-Favlist-Export" target="_blank" class="github-link">
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
            <div class="csv-options-grid">
                <div class="option-card selected" data-option="title">
                    <div class="option-title">标题</div>
                    <div class="option-desc">视频标题信息</div>
                    <input type="checkbox" id="include-title" checked style="display:none">
                </div>
                <div class="option-card selected" data-option="url">
                    <div class="option-title">网址</div>
                    <div class="option-desc">视频链接地址</div>
                    <input type="checkbox" id="include-url" checked style="display:none">
                </div>
                <div class="option-card selected" data-option="foldername">
                    <div class="option-title">收藏夹名称</div>
                    <div class="option-desc">所属收藏夹</div>
                    <input type="checkbox" id="include-foldername" checked style="display:none">
                </div>
                <div class="option-card selected" data-option="created">
                    <div class="option-title">收藏时间</div>
                    <div class="option-desc">添加到收藏的日期</div>
                    <input type="checkbox" id="include-created" checked style="display:none">
                </div>
                <div class="option-card" data-option="uploader">
                    <div class="option-title">用户昵称</div>
                    <div class="option-desc">视频上传者的昵称</div>
                    <input type="checkbox" id="include-uploader" style="display:none">
                </div>
                <div class="option-card" data-option="mid">
                    <div class="option-title">B站ID</div>
                    <div class="option-desc">上传者的用户ID</div>
                    <input type="checkbox" id="include-mid" style="display:none">
                </div>
                <div class="option-card" data-option="views">
                    <div class="option-title">播放量</div>
                    <div class="option-desc">视频观看次数统计</div>
                    <input type="checkbox" id="include-views" style="display:none">
                </div>
                <div class="select-all-card" id="select-all-card">
                    <div class="option-title">全选</div>
                    <div class="option-desc">一键选择所有字段</div>
                </div>
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
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px;">
            <div class="toggle-switch">
                <label for="export-current-folder-only">仅导出当前文件夹</label>
                <label class="switch">
                    <input type="checkbox" id="export-current-folder-only">
                    <span class="switch-slider"></span>
                </label>
            </div>
            <div class="toggle-switch">
                <label for="filter-invalid-videos">过滤已失效视频</label>
                <label class="switch">
                    <input type="checkbox" id="filter-invalid-videos" checked>
                    <span class="switch-slider"></span>
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
        </div>`;
        document.body.appendChild(panel);

        let overlay = document.createElement("div");
        overlay.id = "panel-overlay";
        document.body.appendChild(overlay);

        formatButtons = panel.querySelectorAll('.formatButton');
        formatButtons.forEach(button => {
            button.addEventListener('click', function() {
                const newFormat = this.dataset.format;
                if (newFormat !== exportFormat) {
                    exportFormat = newFormat;
                    GM_setValue('exportFormat', exportFormat);
                    updateFormatButtons();
                }

                if (hasExportedData) {
                    if (exportFormat === 'html' && !exportedData.html) {
                        exportedData.html = htmlTemplateStart
                            .replace("{globalFolderName}", exportedData.htmlConfig.globalFolderName)
                            .replace("{BOOKMARK_TITLE}", exportedData.htmlConfig.title)
                            .replace("{dateNow}", getCurrentTimestamp()) +
                            htmlContent + HTML_TEMPLATE_END;
                    }
                    exportButton.innerHTML = "立即下载";
                    exportButton.onclick = () => {
                        if (exportFormat === "csv") {
                            downloadCSV();
                        } else if (exportFormat === "html") {
                            if (!bookmarkTitleInput.value || !globalFolderNameInput.value) {
                                alert("请配置书签标题和全局父文件夹名称。");
                                return;
                            }
                            downloadHTML();
                        }
                    };
                }
            });
        });

        bookmarkTitleInput = panel.querySelector('#bookmark-title');
        globalFolderNameInput = panel.querySelector('#global-folder-name');

        // 全选按钮逻辑
        panel.querySelector('#select-all-card').addEventListener('click', function() {
            const allCards = panel.querySelectorAll('.option-card[data-option]');
            const allSelected = Array.from(allCards).every(card => {
                const option = card.dataset.option;
                if (['uploader', 'mid', 'views'].includes(option)) {
                    // 新增字段需要检查是否可用
                    if (exportFormat !== 'csv' || !isNewVersionPage()) {
                        return true; // 不可用字段视为"已选中"，避免影响全选判断
                    }
                }
                return card.classList.contains('selected');
            });

            // 切换所有字段状态
            allCards.forEach(card => {
                const option = card.dataset.option;
                const checkbox = card.querySelector('input[type="checkbox"]');

                // 新增字段特殊处理
                if (['uploader', 'mid', 'views'].includes(option)) {
                    if (exportFormat !== 'csv' || !isNewVersionPage()) {
                        return; // 跳过不可用字段
                    }
                }

                const shouldSelect = !allSelected;
                checkbox.checked = shouldSelect;
                csvInclude[option] = shouldSelect;
                GM_setValue(`include_${option}`, shouldSelect);
                card.classList.toggle('selected', shouldSelect);
            });

            updateCSVHeader();

            // 更新全选按钮文案
            this.querySelector('.option-title').textContent = allSelected ? '全选' : '取消全选';
        });

        // 卡片式选择交互
        panel.querySelectorAll('.option-card').forEach(card => {
            card.addEventListener('click', function() {
                const option = this.dataset.option;
                const checkbox = this.querySelector('input[type="checkbox"]');

                // 新增字段的特殊验证
                if (['uploader', 'mid', 'views'].includes(option)) {
                    if (!checkbox.checked) { // 尝试开启
                        if (exportFormat !== 'csv') {
                            alert('该字段仅可在 CSV 导出中使用');
                            return;
                        }
                        if (!isNewVersionPage()) {
                            alert('该字段仅适配新版页面');
                            return;
                        }
                    }
                }

                // 切换状态
                checkbox.checked = !checkbox.checked;
                csvInclude[option] = checkbox.checked;
                GM_setValue(`include_${option}`, csvInclude[option]);
                updateCSVHeader();

                // 更新视觉状态
                this.classList.toggle('selected', checkbox.checked);

                // 更新全选按钮状态
                updateSelectAllButton();
            });
        });

        // 更新全选按钮状态的函数
        function updateSelectAllButton() {
            const allCards = panel.querySelectorAll('.option-card[data-option]');
            const selectAllCard = panel.querySelector('#select-all-card');

            const allSelected = Array.from(allCards).every(card => {
                const option = card.dataset.option;
                if (['uploader', 'mid', 'views'].includes(option)) {
                    if (exportFormat !== 'csv' || !isNewVersionPage()) {
                        return true; // 不可用字段不参与判断
                    }
                }
                return card.classList.contains('selected');
            });

            selectAllCard.querySelector('.option-title').textContent = allSelected ? '取消全选' : '全选';
        }



        panel.querySelector('#export-current-folder-only').addEventListener('change', (e) => {
            exportCurrentFolderOnly = e.target.checked;
            GM_setValue('exportCurrentFolderOnly', exportCurrentFolderOnly);
        });

        panel.querySelector('#filter-invalid-videos').addEventListener('change', (e) => {
            filterInvalidVideos = e.target.checked;
            GM_setValue('filterInvalidVideos', filterInvalidVideos);
        });

        exportButton = panel.querySelector('#export-button');
        exportButton.onclick = startExport;

        overlay.addEventListener('click', hidePanel);

        updateFormatButtons();
        toggleOptions();
        loadSavedSettings();

        bookmarkTitleInput.addEventListener('input', updateHTMLConfig);
        globalFolderNameInput.addEventListener('input', updateHTMLConfig);

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
    }

    function updateFormatButtons() {
        formatButtons.forEach(button => {
            button.classList.toggle('selected', button.dataset.format === exportFormat);
        });
        const slider = panel.querySelector('.slider');
        slider.style.transform = exportFormat === 'csv' ? 'translateX(0)' : 'translateX(100%)';
        toggleOptions();
        // 更新卡片状态
        updateCardStates();

        if (exportFormat === 'html') {
            // HTML 导出不支持新增字段，若已开启则自动关闭
            const extras = ['uploader','mid','views'];
            let needNotice = extras.some(key => csvInclude[key]);
            if (needNotice) {
                alert('"用户昵称 / B站ID / 播放量"仅可在 CSV 导出中使用。');
            }
            extras.forEach(key => {
                if (csvInclude[key]) {
                    csvInclude[key] = false;
                    GM_setValue(`include_${key}`, false);
                }
                const el = panel.querySelector(`#include-${key}`);
                const card = panel.querySelector(`[data-option="${key}"]`);
                if (el) el.checked = false;
                if (card) card.classList.remove('selected');
            });
            updateCSVHeader();
        }
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

    function loadSavedSettings() {
        ['title', 'url', 'foldername', 'created', 'uploader', 'mid', 'views'].forEach(option => {
            const saved = GM_getValue(`include_${option}`);
            if (saved !== undefined) {
                csvInclude[option] = saved;
                const checkbox = panel.querySelector(`#include-${option}`);
                const card = panel.querySelector(`[data-option="${option}"]`);
                if (checkbox) checkbox.checked = saved;
                if (card) card.classList.toggle('selected', saved);
            }
        });
        updateCSVHeader();

        bookmarkTitleInput.value = GM_getValue('bookmarkTitle', '');
        globalFolderNameInput.value = GM_getValue('globalFolderName', '');
        exportCurrentFolderOnly = GM_getValue('exportCurrentFolderOnly', false);
        panel.querySelector('#export-current-folder-only').checked = exportCurrentFolderOnly;
        filterInvalidVideos = GM_getValue('filterInvalidVideos', true);
        panel.querySelector('#filter-invalid-videos').checked = filterInvalidVideos;

        DELAY = GM_getValue('exportDelay', DELAY_SPEEDS.normal);
        updateSpeedButtons();

        // 延迟执行页面检测和状态更新，确保DOM完全加载
        setTimeout(() => {
            // 启动时校验：HTML 格式或旧版页面均不允许三项开启
            if (exportFormat !== 'csv' || !isNewVersionPage()) {
                ['uploader','mid','views'].forEach(key => {
                    if (csvInclude[key]) {
                        csvInclude[key] = false;
                        GM_setValue(`include_${key}`, false);
                    }
                    const el = panel.querySelector(`#include-${key}`);
                    const card = panel.querySelector(`[data-option="${key}"]`);
                    if (el) el.checked = false;
                    if (card) card.classList.remove('selected');
                });
                updateCSVHeader();
            }

            // 初始化卡片状态
            updateCardStates();
        }, 500); // 延迟500ms确保页面加载完成
    }

    function updateSpeedButtons() {
        const speedButtons = panel.querySelectorAll('.speedButton');
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

    function showPanel() {
        panel.style.opacity = 0;
        panel.style.display = 'block';
        document.getElementById('panel-overlay').style.display = 'block';

        // 每次显示面板时重新检查卡片状态，确保状态正确
        updateCardStates();

        if (hasExportedData) {
            exportButton.innerHTML = "立即下载";
            exportButton.onclick = () => {
                if (exportFormat === "csv") {
                    downloadCSV();
                } else if (exportFormat === "html") {
                    if (!bookmarkTitleInput.value || !globalFolderNameInput.value) {
                        alert("请配置书签标题和全局父文件夹名称。");
                        return;
                    }
                    downloadHTML();
                }
            };
            if (exportedData.errors.length > 0) {
                document.querySelector('#current-exporting').textContent = "导出完成（存在异常）";
            } else {
                document.querySelector('#current-exporting').textContent = "导出完成";
            }
            document.querySelector('#refresh-button').classList.add('show');
        } else {
            exportButton.innerHTML = "开始导出";
            exportButton.onclick = startExport;
            document.querySelector('#current-exporting').textContent = "点击下方按钮开始导出";
            document.querySelector('#refresh-button').classList.remove('show');
        }

        setTimeout(() => { panel.style.opacity = 1; }, 0);
    }

    function hidePanel() {
        panel.style.opacity = 0;
        document.getElementById('panel-overlay').style.display = 'none';
        setTimeout(() => { panel.style.display = 'none'; }, 300);
    }

    function init() {
        createPanel();
        GM_registerMenuCommand("导出 Bilibili 收藏夹", showPanel);
    }

    if (location.href.includes("https://space.bilibili.com/") && location.href.includes("/favlist")) {
        init();
    }
})();
