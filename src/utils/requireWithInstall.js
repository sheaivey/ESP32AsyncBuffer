const { execSync } = require('child_process');

function requireWithInstall(packageName) {
    try {
        return require(packageName);
    } catch (e) {
        console.log(`Installing missing package: ${packageName}...`);
        try {
            execSync(`npm install ${packageName}`, { stdio: 'ignore' });
        }
        catch {}
        console.log(`Done!`);
        return require(packageName);
    }
}

module.exports = requireWithInstall;