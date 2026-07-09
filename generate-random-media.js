const fs = require("fs")
const path = require("path")

const baseDir = path.join(__dirname, "assets/images/random-media")
const dataDir = path.join(__dirname, "assets/data")
const jsDir = path.join(__dirname, "assets/js")

const oldOutputFile = path.join(dataDir, "random_media.json")
const sharedOutputFile = path.join(dataDir, "random_shared_player_media.json")
const jsOutputFile = path.join(jsDir, "random-shared-player-media.js")

const allowed = [".png", ".jpg", ".jpeg", ".webp", ".svg", ".gif"]

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

function readFolder(folderName) {
  const folderPath = path.join(baseDir, folderName)

  if (!fs.existsSync(folderPath)) {
    return []
  }

  return fs
    .readdirSync(folderPath)
    .filter(file => allowed.includes(path.extname(file).toLowerCase()))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((file, index) => {
      return {
        id: index + 1,
        image: `assets/images/random-media/${folderName}/${file}`
      }
    })
}

ensureDir(dataDir)
ensureDir(jsDir)

const saudi = readFolder("saudi")
const world = readFolder("world")

const sharedData = {
  saudi,
  world
}

const flatData = [
  ...saudi,
  ...world
].map((item, index) => ({
  id: index + 1,
  image: item.image
}))

fs.writeFileSync(oldOutputFile, JSON.stringify(flatData, null, 2), "utf8")
fs.writeFileSync(sharedOutputFile, JSON.stringify(sharedData, null, 2), "utf8")

fs.writeFileSync(
  jsOutputFile,
  `window.randomSharedPlayerMedia = ${JSON.stringify({
    saudi: saudi.map(x => x.image),
    world: world.map(x => x.image)
  }, null, 2)};`,
  "utf8"
)

console.log("تم تحديث صور الدوري السعودي:", saudi.length)
console.log("تم تحديث صور العالمي:", world.length)
console.log("تم تحديث random_media.json بعدد:", flatData.length)