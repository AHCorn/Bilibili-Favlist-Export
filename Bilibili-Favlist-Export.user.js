// ==UserScript==
// @name         哔哩哔哩收藏夹导出
// @namespace    https://github.com/AHCorn/Bilibili-Favlist-Export
// @icon         https://www.bilibili.com/favicon.ico
// @version      1.0
// @description  导出哔哩哔哩收藏夹为 CSV 或 HTML 文件，以便导入 Raindrop 或 Firefox。
// @author       AHCorn
// @match        http*://space.bilibili.com/*/*
// @grant        GM_addStyle
// @grant        GM_download
// @grant        GM_registerMenuCommand
// ==/UserScript==


(function () {
    'use strict';

    const DELAY = 2000;
    let csvHeaderOptions = {
        title: "\uFEFFtitle",
        url: "url",
        foldername: "folder"
    };
    let csvHeaderActive = ["\uFEFFtitle", "url", "folder"];
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
        foldername: true
    };
    const PANEL_STYLE = `
    #Panel {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 320px;
        height: 360px;
        background-color: white;
        border: 1px solid #fff;
        border-radius: 10px;
        box-shadow: 0 0 20px rgba(0,0,0,0.2);
        z-index: 9999;
        display: none;
        transition: opacity 0.3s ease-in-out;
    }
    #progress {
        position: absolute;
        top: 260px;
        left: 35px;
        width: 250px;
        height: 30px;
        border: 1px solid #2196F3;
        border-radius: 10px;
        overflow: hidden;
    }
    #progress > div {
        width: 0%;
        height: 100%;
        background-color: #ff6161;
        transition: width 0.3s ease-in-out;
    }
    #button, #backButton, #confirmButton {
        position: absolute;
        bottom: 25px;
        width: 100px;
        height: 30px;
        background-color: #2196F3;
        border: none;
        border-radius: 10px;
        color: white;
        font-weight: bold;
        cursor: pointer;
        transition: background-color 0.3s ease-in-out;
    }
    #button:hover, #backButton:hover, #confirmButton:hover {
        background-color: #64B5F6;
    }
    #button:active, #backButton:active, #confirmButton:active {
        background-color: #1976D2;
    }
#button {
    width:255px;
        margin-left: 35px;

}
#confirmButton {
    left: calc(50% - 125px);
    display:none!important;
}
    #backButton {
        left: 35px;
    }
    #cancel {
        position: absolute;
        top: 10px;
        right: 10px;
        width: 20px;
        height: 20px;
        border: none;
        border-radius: 50%;
        background-color: #F44336;
        color: white;
        font-size: 16px;
        font-weight: bold;
        text-align: center;
        line-height: 20px;
        cursor: pointer;
        transition: background-color 0.3s ease-in-out;
    }
    #cancel:hover {
        background-color: #EF5350;
    }
    #cancel:active {
        background-color: #E53935;
    }
    #tip, #inputTip {
        position: absolute;
        top: 25px;
        left: 35px;
        width: 250px;
        height: 20px;
        color: #2196F3;
        font-size: 15px;
        font-family: Arial, sans-serif;
        text-align: center;
        line-height: 20px;
    }
    #inputTip {
        top: 235px;
    }
    #formatSelector {
        position: absolute;
        top: 60px;
        left: 35px;
        width: 250px;
        height: 40px;
        background-color: #f0f0f0;
        border: 1px solid #2196F3;
        border-radius: 20px;
        display: flex;
        align-items: center;
        justify-content: space-around;
        padding: 5px;
        box-sizing: border-box;
    }
    .csvOptionButton {
        display: block;
        width: 90%;
        margin: 5px auto;
        padding: 10px;
        border: 1px solid #007bff;
        border-radius: 5px;
        background-color: white;
        color: #3596ff;
        cursor: pointer;
        font-size: 16px;
        transition: all 0.3s ease;
    }
    .csvOptionButton.selected {
    transition: font-weight 1s ease-in-out;
        background-color: #3596ff;
        color: white;
    }
    .formatButton {
    z-index:1;
        display: inline-block;
        width: 110px;
        height: 30px;
        line-height: 30px;
        text-align: center;
        border: none;
        border-radius: 15px;
        background-color: transparent;
        cursor: pointer;
        transition: color 0.3s ease-in-out;
    }
    .formatButton.selected {
        font-weight: bold;
        color: #FFF;
    }
    .slider {
        position: absolute;
        left: 5px;
        top: 5px;
        background-color: #2196F3;
        border-radius: 15px;
        transition: left 0.3s ease-in-out;
        width: 110px;
        height: 30px;
        z-index: 0;
        display: flex;
        justify-content: center;
        align-items: center;
        color: white;
        font-weight: bold;
    }
    .folderInputSection input {
    width:205px!important;
    margin:6px;
    padding:18px!important;
    }
    .folderInputSection, .csvOptionsSection {
        position: absolute;
        top: 110px;
        left: 35px;
        width: 250px;
        display: none;
    }
    .csvOptionsSection > .csvOptionButton {
    width:250px!important;
    }
    .folderInputSection > input, .csvOptionsSection > .csvOptionButton {
        padding: 9px;

        border: 1px solid #ccc;
        border-radius: 5px;
        font-size: 14px;
    }
    .successModal {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 300px;
        padding: 20px;
        background-color: white;
        border: 1px solid #2196F3;
        border-radius: 10px;
        box-shadow: 0 0 20px rgba(0,0,0,0.3);
        z-index: 10000;
        text-align: center;
        display: none;
    }
    `;

    let gen = listGen();
    let panel = null;
    let progress = null;
    let button = null;
    let confirmButton = null;
    let cancel = null;
    let tip = null;
    let inputTip = null;
    let formatSelector = null;
    let slider = null;
    let folderInputSection = null;
    let bookmarkTitleInput = null;
    let globalFolderNameInput = null;
    let csvOptionsSection = null;
    let totalPage = 0;
    let currentPage = 0;
    let isExporting = false;
    let exportFormat = "csv";

    function getCSVFileName() {
        let userName = $("#h-name").text();
        return userName + "的收藏夹.csv";
    }

    function getHTMLFileName() {
        let userName = $("#h-name").text();
        return userName + "的收藏夹.html";
    }

    function getFolderName() {
        return $("#fav-createdList-container .fav-item.cur a.text").text().trim();
    }

    function escapeCSV(field) {
        return '"' + String(field).replace(/"/g, '""') + '"';
    }

    function getCurrentTimestamp() {
        return Math.floor(Date.now() / 1000);
    }

    function addHTMLFolder(folderName) {
        if (folderName !== globalParentFolderName) {
            if (globalParentFolderName !== "") {
                htmlContent += `</DL><p>\n`;
            }
            let dateNow = getCurrentTimestamp();
        }
    }

    function addHTMLBookmark(folderName, title, url) {
        addHTMLFolder(folderName);
        let dateNow = getCurrentTimestamp();
        htmlContent += `<DT><A HREF="${url}" ADD_DATE="${dateNow}" LAST_MODIFIED="${dateNow}">${title}</A>\n`;
    }

function generateCSVLine(folderName, title, url) {
    let parts = [];
    if (csvInclude.title) parts.push(escapeCSV(title));
    if (csvInclude.url) parts.push(escapeCSV(url));
    if (csvInclude.foldername) parts.push(escapeCSV(folderName));
    return parts.join(',');
}

    function addHTMLFolder(folderName) {
        let dateNow = getCurrentTimestamp();
        if (folderName !== globalParentFolderName) {
            if (globalParentFolderName !== "") {
                htmlContent += `</DL><p>\n`;
            }
        }
        htmlContent += `<DT><H3 ADD_DATE="${dateNow}" LAST_MODIFIED="${dateNow}">${folderName}</H3>\n<DL><p>\n`;
    }

    function getVideosFromPage() {
        var results = [];
        var folderName = getFolderName().replace(/\//g, '\\');
        $(".fav-video-list > li > a.title").each(function () {
            var title = $(this).text().replace(/,/g, '');
            if (title !== "已失效视频") {
                var url = 'https:' + $(this).attr("href");
                results.push(generateCSVLine(folderName, title, url));
                if (exportFormat === "html") {
                    addHTMLBookmark(folderName, title, url);
                }
            }
        });
        return results.join('\n');
    }

    function processVideos () {
        if (isExporting) {
            csvContent += getVideosFromPage () + '\n';
            currentPage++;
            updateProgress ();
            if ($(".be-pager-next:visible").length == 0) {
                setTimeout (changeList, DELAY);
            } else {
                $(".be-pager-next").click ();
                setTimeout (processVideos, DELAY);
            }
        }
    }
    function* listGen() {
        for (let list of $("#fav-createdList-container .fav-item a").get()) {
            yield list;
        }
    }

function changeList() {
    if (isExporting) {
        let list = gen.next().value;
        if (list) {
            list.click();
            setTimeout(() => {
                totalPage = parseInt($(".be-pager-total").text().match(/\d+/)[0]);
                currentPage = 0;
                updateProgress();
                updateTip();
                processVideos();
            }, DELAY);
        } else {
            isExporting = false;
            button.textContent = "立即下载";
            button.disabled = false;
            button.onclick = () => {
                if (exportFormat === "csv") {
                    downloadCSV();
                } else if (exportFormat === "html") {
                    downloadHTML();
                }
                button.textContent = "开始导出";
                button.disabled = true;
                setTimeout(() => {
                    button.disabled = false;
                }, 3000);
            };

        }
    }
}


function downloadCSV() {
    let fileName = getCSVFileName();
    let blobUrl = URL.createObjectURL(new Blob([csvContent], {type: 'text/csv;charset=utf-8;'}));
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
            let htmlBlob = new Blob([htmlContent], {type: 'text/html;charset=utf-8;'});
            let htmlBlobUrl = URL.createObjectURL(htmlBlob);
            window.open(htmlBlobUrl, '_blank');
        }
    });
}

function downloadHTML() {
    let fileName = getHTMLFileName();
    let globalParentFolderName = globalFolderNameInput.value;
    let htmlFinalContent = htmlTemplateStart.replace("{globalFolderName}", globalFolderNameInput.value).replace("{BOOKMARK_TITLE}", bookmarkTitleInput.value.trim()) + htmlContent + HTML_TEMPLATE_END;
    let blobUrl = URL.createObjectURL(new Blob([htmlFinalContent], {type: 'text/html;charset=utf-8;'}));
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
            let htmlBlob = new Blob([htmlContent], {type: 'text/html;charset=utf-8;'});
            let htmlBlobUrl = URL.createObjectURL(htmlBlob);
            window.open(htmlBlobUrl, '_blank');
        }
    });
}


    function createPanel() {
        panel = document.createElement("div");
        panel.id = "Panel";
        document.body.appendChild(panel);

        formatSelector = document.createElement("div");
        formatSelector.id = "formatSelector";
        slider = document.createElement("div");
        slider.className = "slider";
        formatSelector.appendChild(slider);
        let csvButton = document.createElement("div");
        csvButton.className = "formatButton selected";
        csvButton.textContent = "CSV";
        csvButton.addEventListener("click", () => {
            exportFormat = "csv";
            slider.style.left = "9px";
            csvButton.classList.add("selected");
            htmlButton.classList.remove("selected");
            folderInputSection.style.display = "none";
            csvOptionsSection.style.display = "block";
            confirmButton.style.display = "block";
        });
        let htmlButton = document.createElement("div");
        htmlButton.className = "formatButton";
        htmlButton.textContent = "HTML";
        htmlButton.addEventListener("click", () => {
            exportFormat = "html";
            slider.style.left = "126px";
            htmlButton.classList.add("selected");
            csvButton.classList.remove("selected");
            folderInputSection.style.display = "block";
            csvOptionsSection.style.display = "none";
            confirmButton.style.display = "block";
        });
        formatSelector.appendChild(csvButton);
        formatSelector.appendChild(htmlButton);
        panel.appendChild(formatSelector);

        folderInputSection = document.createElement("div");
        folderInputSection.className = "folderInputSection";
        bookmarkTitleInput = document.createElement("input");
        bookmarkTitleInput.placeholder = "书签标题 (H1)";
        folderInputSection.appendChild(bookmarkTitleInput);
        globalFolderNameInput = document.createElement("input");
        globalFolderNameInput.placeholder = "全局父文件夹名称";
        folderInputSection.appendChild(globalFolderNameInput);
        panel.appendChild(folderInputSection);

        csvOptionsSection = document.createElement("div");
        csvOptionsSection.className = "csvOptionsSection";
        csvOptionsSection.style.display = "block";
        ["title", "url", "foldername"].forEach((option) => {
            let button = document.createElement("button");
            button.className = "csvOptionButton" + (csvInclude[option] ? " selected" : "");
            button.textContent = option;
            button.onclick = () => {
                csvInclude[option] = !csvInclude[option];
                button.classList.toggle("selected");
                updateCSVHeader();
                csvContent = csvHeaderActive.join(",") + "\n";
            };
            csvOptionsSection.appendChild(button);
        });
        panel.appendChild(csvOptionsSection);

        confirmButton = document.createElement("button");
        confirmButton.id = "confirmButton";
        confirmButton.textContent = "确认";
        confirmButton.style.display = "none";
        confirmButton.onclick = () => {
            if (exportFormat === "html" && (!bookmarkTitleInput.value || !globalFolderNameInput.value)) {
                alert("请配置书签标题和全局父文件夹名称。");
                return;
            }
            showSuccessModal("设置已保存成功！");
        };
        panel.appendChild(confirmButton);
    }

    function createProgress() {
        progress = document.createElement("div");
        progress.id = "progress";
        let bar = document.createElement("div");
        progress.appendChild(bar);
        panel.appendChild(progress);
    }

    function createButton() {
        button = document.createElement("button");
        button.id = "button";
        button.textContent = "开始导出";
        button.onclick = () => {
            if (exportFormat === "html" && (!bookmarkTitleInput.value || !globalFolderNameInput.value)) {
                alert("请配置书签标题和全局父文件夹名称。");
                return;
            }
            button.disabled = true;
            button.textContent = "导出中...";
            isExporting = true;
            htmlContent = "";
            csvContent = csvHeaderActive.join(",") + "\n";
            changeList();
        };
        panel.appendChild(button);
    }

    function createCancel() {
        cancel = document.createElement("button");
        cancel.id = "cancel";
        cancel.textContent = "×";
        cancel.onclick = () => {
            isExporting = false;
            button.disabled = false;
            button.textContent = "开始导出";
            hidePanel();
        };
        panel.appendChild(cancel);
    }

    function createTip() {
        tip = document.createElement("div");
        tip.id = "tip";
        tip.textContent = "当前正在导出：";
        panel.appendChild(tip);
    }
//废弃
    function showSuccessModal(message) {
        let modal = document.createElement("div");
        modal.className = "successModal";
        modal.textContent = message;
        document.body.appendChild(modal);
        modal.style.display = "block";
        setTimeout(() => {
            modal.style.opacity = 0;
            setTimeout(() => {
                document.body.removeChild(modal);
            }, 500);
        }, 2000);
    }

    function showPanel() {
        panel.style.opacity = 0;
        panel.style.display = "block";
        setTimeout(() => {
            panel.style.opacity = 1;
        }, 0);
        confirmButton.style.display = exportFormat === "html" ? "block" : "block";
    }

    function hidePanel() {
        panel.style.opacity = 0;
        setTimeout(() => {
            panel.style.display = "none";
        }, 300);
    }

    function updateProgress() {
        let percentage = Math.round(currentPage / totalPage * 100) + "%";
        progress.querySelector("div").style.width = percentage;
        progress.title = percentage;
    }

    function updateTip() {
        let folderName = getFolderName();
        tip.textContent = "当前正在导出：" + folderName;
    }

    function init() {
        GM_addStyle(PANEL_STYLE);
        createPanel();
        createProgress();
        createButton();
        createCancel();
        createTip();
      updateCSVHeader();
        GM_registerMenuCommand("导出 Bilibili 收藏夹", showPanel);
    }

    if (location.href.includes("https://space.bilibili.com/") && location.href.includes("/favlist")) {
        init();
    }
})();
