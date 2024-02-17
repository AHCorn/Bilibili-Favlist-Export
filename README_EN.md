<div align="center">

# 🚛 Bilibili-Favlist-Export

### <a href="https://github.com/AHCorn/Bilibili-Favlist-Export/"> Simplified Chinese </a>  / English 

Export Bilibili favorites to CSV or HTML files for importing into Raindrop or Firefox.

![JavaScript](https://img.shields.io/badge/javascript-%23323330.svg?style=for-the-badge&logo=javascript&logoColor=%23F7DF1E) 

</div>

## ⚠ Warm Tips
The script's preferred download function has only been tested with the **Tampermonkey** extension in the Vivaldi browser.

For Greasemonkey or other browsers, downloads require opening a new tab. For safety, **please be sure to enable pop-up permissions for Bilibili**❗

This script has just been released. Although I have tested it dozens of times personally, there may still be potential issues that have not been discovered. Considering the lengthy export time, please choose cautiously.

The export speed is fixed in the code at ``` const DELAY = 2000; ```. If your loading speed is sufficient, you can reduce the delay.

If your favorites are misplaced, it is due to the mismatch between network conditions and the export delay.

If you wish to use it with the Favorites Fix, please increase the delay to at least 4000 to wait for the script to load.



<br>

## ⭐ Features
1. Has an independent export panel.
2. Automatically traverses all favorite videos.
3. Supports user-selected export formats.
4. Supports user-selected export content (CSV).
5. Supports user-defined parent bookmark folder (HTML).
6. Real-time export progress view.
   
<br>


## 💻 Usage
This version is a derivative of [Bilibili-To-Raindrop](https://github.com/AHCorn/Bilibili-To-Raindrop), which is more convenient to use and supports a wider range of formats and customization.

If you only need to export to the CSV file required by the Raindrop format, seeking compatibility and speed, you can use the console script directly without installing a Tampermonkey script.

Press F12 on the Bilibili favorites page, or right-click to inspect, and paste the following code into the browser console (console)
```js
var delay = 2000; // Wait time
var gen = listGen();
var csvContent = "\uFEFF";
csvContent += "folder,title,url\n";

function getCSVFileName() {
    var userName = $("#h-name").text();
    return userName + "'s Favorites.csv";
}

function getFolderName() {
    return $("#fav-createdList-container .fav-item.cur a.text").text().trim();
}

function escapeCSV(field) {
    return '"' + String(field).replace(/"/g, '""') + '"';
}

function getVideosFromPage() {
    var results = [];
    var folderName = getFolderName().replace(/\//g, '\\'); // Replace / with \ to avoid Raindrop recognition errors
    $(".fav-video-list > li > a.title").each(function() {
        var title = $(this).text().replace(/,/g, '');
        if (title !== "Invalid Video") {
            var url = 'https:' + $(this).attr("href");
            results.push(escapeCSV(folderName) + ',' + escapeCSV(title) + ',' + escapeCSV(url));
        }
    });
    return results.join('\n');
}

function processVideos() {
    csvContent += getVideosFromPage() + '\n'; // Auto line break
    if ($(".be-pager-next:visible").length == 0) {
        setTimeout(changeList, delay);
    } else {
        $(".be-pager-next").click();
        setTimeout(processVideos, delay);
    }
}

function* listGen() {
    for (var list of $("#fav-createdList-container .fav-item a").get()) {
        yield list;
    }
}

function changeList() {
    var list = gen.next().value;
    if (list) {
        list.click();
        setTimeout(processVideos, delay);
    } else {
        downloadCSV();
    }
}

function downloadCSV() {
    var fileName = getCSVFileName();
    var blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);

    var win = window.open();
    if (win) {
        win.document.open();
        win.document.write('<html><body>');
        win.document.write('<a href="' + url + '" download="' + fileName + '">Click to download</a>');
        win.document.write('<script>document.querySelector("a").click();</script>');
        win.document.write('</body></html>');
        win.document.close();
    } else {
        alert('Download window was blocked by the browser, please allow pop-ups in the settings and try again.');
    }
}

changeList();

```

## ❤️ Thanks

The original fetching code comes from [快速导出B站收藏单节目列表 - 鱼肉真好吃](https://www.cnblogs.com/toumingbai/p/11399238.html). 

If you need to backup your entire Bilibili favorites folder in text format, you can also use this open-source project: [BiliBackup](https://github.com/sweatran/BiliBackup?tab=readme-ov-file)
