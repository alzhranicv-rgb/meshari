window.randomSharedPlayerMedia = {
  "saudi": [
    "assets/images/random-media/saudi/ابها.png",
    "assets/images/random-media/saudi/الاتحاد.png",
    "assets/images/random-media/saudi/الاتفاق.png",
    "assets/images/random-media/saudi/الاخدود.png",
    "assets/images/random-media/saudi/الاردن 10.png",
    "assets/images/random-media/saudi/الاهلي.png",
    "assets/images/random-media/saudi/الباطن.png",
    "assets/images/random-media/saudi/البرازيل 8.png",
    "assets/images/random-media/saudi/التعاون 9.png",
    "assets/images/random-media/saudi/الجزائر 11.png",
    "assets/images/random-media/saudi/الحزم.png",
    "assets/images/random-media/saudi/الخلود.png",
    "assets/images/random-media/saudi/الخليج.png",
    "assets/images/random-media/saudi/الدرعية.png",
    "assets/images/random-media/saudi/الرايد.png",
    "assets/images/random-media/saudi/الرياض.png",
    "assets/images/random-media/saudi/السعودية 7.png",
    "assets/images/random-media/saudi/الشباب.png",
    "assets/images/random-media/saudi/العراق 12.png",
    "assets/images/random-media/saudi/العروبة.png",
    "assets/images/random-media/saudi/العلا.png",
    "assets/images/random-media/saudi/الفتح.png",
    "assets/images/random-media/saudi/الفيحاء.png",
    "assets/images/random-media/saudi/القادسية.png",
    "assets/images/random-media/saudi/الكويت 6.png",
    "assets/images/random-media/saudi/المغرب 5.png",
    "assets/images/random-media/saudi/النجمة.png",
    "assets/images/random-media/saudi/النصر.png",
    "assets/images/random-media/saudi/الهلال.png",
    "assets/images/random-media/saudi/الوحدة.png",
    "assets/images/random-media/saudi/تونس 1.png",
    "assets/images/random-media/saudi/سوريا 2.png",
    "assets/images/random-media/saudi/ضمك.png",
    "assets/images/random-media/saudi/لبنان 3.png",
    "assets/images/random-media/saudi/مصر 4.png",
    "assets/images/random-media/saudi/نيوم.png"
  ],
  "world": [
    "assets/images/random-media/world/اتليتكو مدريد.png",
    "assets/images/random-media/world/اجاكس.png",
    "assets/images/random-media/world/ارسلان.png",
    "assets/images/random-media/world/اسبانيا 11.png",
    "assets/images/random-media/world/اشبيليا.png",
    "assets/images/random-media/world/الارجنتين 6.png",
    "assets/images/random-media/world/البرازيل 5.png",
    "assets/images/random-media/world/الجزائر 4.png",
    "assets/images/random-media/world/السويد 3.png",
    "assets/images/random-media/world/المانيا 10.png",
    "assets/images/random-media/world/المغرب 9.png",
    "assets/images/random-media/world/اليابان 8.png",
    "assets/images/random-media/world/اليوفي.png",
    "assets/images/random-media/world/انتر ميلان.png",
    "assets/images/random-media/world/انجلترا 19.png",
    "assets/images/random-media/world/اي سي ميلان.png",
    "assets/images/random-media/world/ايطاليا 7.png",
    "assets/images/random-media/world/باريس.png",
    "assets/images/random-media/world/بايرن ميونخ.png",
    "assets/images/random-media/world/برشلونة.png",
    "assets/images/random-media/world/بروسيا دورتموند.png",
    "assets/images/random-media/world/بلجيكا 17.png",
    "assets/images/random-media/world/بنفيكا.png",
    "assets/images/random-media/world/بورتو.png",
    "assets/images/random-media/world/تركيا 16.png",
    "assets/images/random-media/world/تشيلسي.png",
    "assets/images/random-media/world/تونتنهام.png",
    "assets/images/random-media/world/جالكسي.png",
    "assets/images/random-media/world/روما.png",
    "assets/images/random-media/world/ريال مدريد.png",
    "assets/images/random-media/world/صربيا 18.png",
    "assets/images/random-media/world/غلطة سراي.png",
    "assets/images/random-media/world/فرنسا 2.png",
    "assets/images/random-media/world/فنربخشة.png",
    "assets/images/random-media/world/كرواتيا 14.png",
    "assets/images/random-media/world/كوريا 15.png",
    "assets/images/random-media/world/ليستر سيتي.png",
    "assets/images/random-media/world/ليفربول.png",
    "assets/images/random-media/world/مان سيتي.png",
    "assets/images/random-media/world/مان يونايتد.png",
    "assets/images/random-media/world/مصر 1.png",
    "assets/images/random-media/world/نابولي.png",
    "assets/images/random-media/world/هولندا 12.png",
    "assets/images/random-media/world/ويلز 13.png"
  ]
};
/* =========================
   Random Shared Media Cache
========================= */

const randomSharedMediaLoaded =
  new Set()

const randomSharedMediaPromises =
  new Map()

function preloadRandomSharedImage(src) {
  const cleanSrc =
    String(src || "").trim()

  if (!cleanSrc) {
    return Promise.resolve(false)
  }

  if (
    randomSharedMediaLoaded.has(
      cleanSrc
    )
  ) {
    return Promise.resolve(true)
  }

  if (
    randomSharedMediaPromises.has(
      cleanSrc
    )
  ) {
    return randomSharedMediaPromises.get(
      cleanSrc
    )
  }

  const promise =
    new Promise(resolve => {
      const image =
        new Image()

      image.decoding = "async"

      image.onload = () => {
        randomSharedMediaLoaded.add(
          cleanSrc
        )

        randomSharedMediaPromises.delete(
          cleanSrc
        )

        resolve(true)
      }

      image.onerror = () => {
        randomSharedMediaPromises.delete(
          cleanSrc
        )

        resolve(false)
      }

      image.src = cleanSrc
    })

  randomSharedMediaPromises.set(
    cleanSrc,
    promise
  )

  return promise
}

async function loadRandomSharedImage(
  src
) {
  const loaded =
    await preloadRandomSharedImage(
      src
    )

  return loaded
    ? src
    : ""
}

function preloadNextRandomSharedImages(
  category,
  currentIndex,
  count = 2
) {
  const list =
    window.randomSharedPlayerMedia?.[
      category
    ] || []

  if (!list.length) return

  const start =
    Number(currentIndex || 0) + 1

  const images = []

  for (
    let offset = 0;
    offset < count;
    offset++
  ) {
    const index =
      (start + offset) %
      list.length

    if (list[index]) {
      images.push(
        list[index]
      )
    }
  }

  const runPreload = () => {
    images.forEach(src => {
      preloadRandomSharedImage(
        src
      )
    })
  }

  if (
    "requestIdleCallback" in window
  ) {
    requestIdleCallback(
      runPreload,
      {
        timeout: 1200
      }
    )
  } else {
    setTimeout(
      runPreload,
      150
    )
  }
}

function getRandomSharedMediaList(
  category
) {
  return Array.isArray(
    window
      .randomSharedPlayerMedia?.[
        category
      ]
  )
    ? window
        .randomSharedPlayerMedia[
          category
        ]
    : []
}

window.preloadRandomSharedImage =
  preloadRandomSharedImage

window.loadRandomSharedImage =
  loadRandomSharedImage

window.preloadNextRandomSharedImages =
  preloadNextRandomSharedImages

window.getRandomSharedMediaList =
  getRandomSharedMediaList