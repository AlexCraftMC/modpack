/*

    Script to build our modpack!

*/

// Libraries
const fs = require('fs');
const https = require('https');
const request = require('request');
const zip = require('node-zip');

// Modpack json!
const config = require('../modpack.json');

// Constants
const build_root = "../tmp/build";
const minecraft_version = "1.16.5";
const forge_version = "36.2.0";


// Utils
function getForgeDownloadPath() {
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
    const download = (url, dest, cb) => {
        const file = fs.createWriteStream(dest);
        const sendReq = request.get(url);

        // verify response code
        sendReq.on('response', (response) => {
            if (response.statusCode !== 200) {
                return cb('Response status was ' + response.statusCode);
            }

            sendReq.pipe(file);
        });

        // close() is async, call cb after close completes
        file.on('finish', () => file.close(cb));

        // check for request errors
        sendReq.on('error', (err) => {
            fs.unlink(dest);
            return cb(err.message);
        });

        file.on('error', (err) => { // Handle errors
            fs.unlink(dest); // Delete the file async. (But we don't check the result)
            return cb(err.message);
        });
    };

    return new Promise((resolve, reject) => {
        download(url, path, () => {
            resolve();
        })
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

async function install_curse_mod(projectId, fileId) {
    var file_url = await httpGET(`https://addons-ecs.forgesvc.net/api/v2/addon/${projectId}/file/${fileId}/download-url`);
    var segments = file_url.split('/')
    var file_name = segments[segments.length - 1];
    console.log(`Downloading mod "${file_name}"...`);
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
        console.log(`Downloading mod "${file_name}"...`);
        awaiting.push(downloadFile(url, `${build_root}/mods/${file_name}`));
    });

    await Promise.all(awaiting);
}

async function install_forge() {
    var url = getForgeDownloadPath();
    await downloadFile(url, `${build_root}/bin/modpack.jar`);
}

async function create_zip() {
    return new Promise((resolve, reject) => {
        var arch = zip();

        arch.file(`${build_root}/build/bin`, `${build_root}/build/mods`);
        fs.writeFileSync(`${build_root}/modpack.zip`, arch.generate({
          base64: false,
          compression: 'DEFLATE'  
        }), 'binary', (err) => {
            reject(err);
        });
        resolve();
    });
}

// Main!
(async () => {
    console.log("Building modpack...");
    init();
    await install_mods();
    await install_forge();
    // await create_zip();
})()