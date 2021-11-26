/*

    Script to build our modpack!

*/

// Libraries
const fs = require('fs');
const https = require('https');

// Modpack json!
const config = require('../modpack.json');

// Constants
const build_root = "../tmp/build";
const minecraft_version = "1.16.5";
const forge_version = "36.2.0";


// Utils
function getForgeDownload(version) {
    var version_string = `${minecraft_version}-${forge_version}`
    return `https://files.minecraftforge.net/maven/net/minecraftforge/forge/${version_string}/forge-${version_string}-universal.jar`
}

function mkdirIfNotExists(path) {
    if (!fs.existsSync(path))
        fs.mkdirSync(path);
}

function httpGET(url) {
    return new Promise((resolve, reject) => {
        var buffer = '';
        const req = https.get(url, res => {
            res.on('data', d => {buffer += d});
            res.on('end', () => {resolve(buffer);});
        })
        req.on('error', (err) => reject(err));
        req.end();
    });
}

function downloadFile(url, path) {
    console.log(`Downloading @ "${url}"`)

    return new Promise((resolve, reject) => {
        try {
            https.get(url, (res) => {

                console.log(res.headers);

                const filePath = fs.createWriteStream(path);

                res.pipe(filePath);
                filePath.on('finish',() => {
                    filePath.close();
                    resolve();
                });
            });
        } catch (err) {
            reject(err);
        }
    });
}

// Stages
function init() {
    try {
        mkdirIfNotExists('../tmp/')
        mkdirIfNotExists(build_root);
        mkdirIfNotExists(`${build_root}/bin`);
        mkdirIfNotExists(`${build_root}/mods`);
    } catch (err) {
        console.error(err);
    }
}

async function get_curse_file_url(projectId, fileId) {

}

async function install_curse_mod(projectId, fileId) {
    // https://www.curseforge.com/minecraft/mc-mods/jei/download/3040523/file
    var file_url = await httpGET(`https://addons-ecs.forgesvc.net/api/v2/addon/${projectId}/file/${fileId}/download-url`);
    
    var segments = file_url.split('/')
    var file_name = segments[segments.length - 1];

    await downloadFile(file_url, `${build_root}/mods/${file_name}`);
}

async function install_mods() {
    var awaiting = [];

    config.mods.curse.forEach(mod => {
        awaiting.push(install_curse_mod(mod.projectID, mod.fileID));
    });

    config.mods.urls.forEach(url => {
        var segments = url.split('/')
        var file_name = segments[segments.length - 1];
        awaiting.push(downloadFile(url, `${build_root}/mods/${file_name}`));
    });
    await Promise.all(awaiting);
}


// Main!
(async () => {
    console.log("Building modpack...");
    init();
    await install_mods();
})()