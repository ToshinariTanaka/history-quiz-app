const CORRECT_SOUND_STORAGE_KEY = "historyQuizAppCorrectSound_v1"
const DEFAULT_CORRECT_SOUND = "kirarin"

function getSavedCorrectSound() {
  try {
    return window.localStorage.getItem(CORRECT_SOUND_STORAGE_KEY) || DEFAULT_CORRECT_SOUND
  } catch (error) {
    console.error("load correct sound error", error)
    return DEFAULT_CORRECT_SOUND
  }
}

function saveCorrectSound(value) {
  try {
    window.localStorage.setItem(CORRECT_SOUND_STORAGE_KEY, value)
  } catch (error) {
    console.error("save correct sound error", error)
  }
}

function playToneWithLightEcho(context, options, echoOptions = {}) {
  playTone(context, options)

  const {
    echoes = 2,
    delay = 0.1,
    decay = 0.45,
    releaseBoost = 0.06
  } = echoOptions

  let currentVolume = options.volume ?? 0.1
  let currentDelay = delay

  for (let i = 0; i < echoes; i += 1) {
    currentVolume *= decay
    if (currentVolume < 0.01) {
      break
    }

    playTone(context, {
      ...options,
      startOffset: (options.startOffset || 0) + currentDelay,
      volume: currentVolume,
      release: (options.release || 0.08) + releaseBoost
    })

    currentDelay += delay
  }
}

async function playPresetKirarin() {
  const context = await prepareAudio()
  if (!context) {
    return
  }

  playToneWithLightEcho(context, {
    type: "triangle",
    frequency: 880,
    endFrequency: 1040,
    startOffset: 0,
    duration: 0.12,
    volume: 0.12,
    attack: 0.01,
    release: 0.1
  }, {
    echoes: 2,
    delay: 0.09,
    decay: 0.42,
    releaseBoost: 0.05
  })

  playToneWithLightEcho(context, {
    type: "triangle",
    frequency: 1175,
    endFrequency: 1318,
    startOffset: 0.11,
    duration: 0.16,
    volume: 0.14,
    attack: 0.01,
    release: 0.12
  }, {
    echoes: 2,
    delay: 0.09,
    decay: 0.42,
    releaseBoost: 0.06
  })

  playToneWithLightEcho(context, {
    type: "sine",
    frequency: 1568,
    endFrequency: 1760,
    startOffset: 0.22,
    duration: 0.24,
    volume: 0.1,
    attack: 0.01,
    release: 0.18
  }, {
    echoes: 2,
    delay: 0.1,
    decay: 0.46,
    releaseBoost: 0.08
  })
}

async function playPresetPingPong() {
  const context = await prepareAudio()
  if (!context) {
    return
  }

  playToneWithLightEcho(context, {
    type: "sine",
    frequency: 988,
    endFrequency: 988,
    startOffset: 0,
    duration: 0.12,
    volume: 0.1,
    attack: 0.01,
    release: 0.08
  }, {
    echoes: 1,
    delay: 0.08,
    decay: 0.38,
    releaseBoost: 0.04
  })

  playToneWithLightEcho(context, {
    type: "sine",
    frequency: 1318,
    endFrequency: 1318,
    startOffset: 0.16,
    duration: 0.2,
    volume: 0.12,
    attack: 0.01,
    release: 0.1
  }, {
    echoes: 1,
    delay: 0.08,
    decay: 0.38,
    releaseBoost: 0.05
  })
}

async function playPresetLevelUp() {
  const context = await prepareAudio()
  if (!context) {
    return
  }

  ;[
    { frequency: 659, startOffset: 0, duration: 0.08, volume: 0.08 },
    { frequency: 784, startOffset: 0.09, duration: 0.08, volume: 0.09 },
    { frequency: 988, startOffset: 0.18, duration: 0.1, volume: 0.1 },
    { frequency: 1318, startOffset: 0.29, duration: 0.16, volume: 0.12 }
  ].forEach((note, index) => {
    playToneWithLightEcho(context, {
      type: "triangle",
      frequency: note.frequency,
      endFrequency: note.frequency,
      startOffset: note.startOffset,
      duration: note.duration,
      volume: note.volume,
      attack: 0.01,
      release: 0.08
    }, {
      echoes: index < 2 ? 1 : 2,
      delay: 0.07,
      decay: 0.4,
      releaseBoost: 0.04
    })
  })
}

async function playPresetSoftBell() {
  const context = await prepareAudio()
  if (!context) {
    return
  }

  playToneWithLightEcho(context, {
    type: "sine",
    frequency: 784,
    endFrequency: 880,
    startOffset: 0,
    duration: 0.18,
    volume: 0.08,
    attack: 0.01,
    release: 0.18
  }, {
    echoes: 2,
    delay: 0.11,
    decay: 0.5,
    releaseBoost: 0.08
  })

  playToneWithLightEcho(context, {
    type: "sine",
    frequency: 1175,
    endFrequency: 1318,
    startOffset: 0.14,
    duration: 0.26,
    volume: 0.07,
    attack: 0.01,
    release: 0.22
  }, {
    echoes: 2,
    delay: 0.11,
    decay: 0.52,
    releaseBoost: 0.09
  })

  playToneWithLightEcho(context, {
    type: "triangle",
    frequency: 1568,
    endFrequency: 1568,
    startOffset: 0.18,
    duration: 0.32,
    volume: 0.05,
    attack: 0.02,
    release: 0.24
  }, {
    echoes: 2,
    delay: 0.12,
    decay: 0.55,
    releaseBoost: 0.1
  })
}

function installCorrectSoundSelector() {
  const correctSoundEl = document.getElementById("correct-sound")
  if (!correctSoundEl) {
    return
  }

  const options = [
    { value: "kirarin", label: "キラリン" },
    { value: "pingpong", label: "ピンポン" },
    { value: "levelup", label: "レベルアップ" },
    { value: "softbell", label: "やさしいベル" },
    { value: "none", label: "なし" }
  ]

  correctSoundEl.innerHTML = ""
  options.forEach((optionData) => {
    const option = document.createElement("option")
    option.value = optionData.value
    option.textContent = optionData.label
    correctSoundEl.appendChild(option)
  })

  const savedValue = getSavedCorrectSound()
  const validValue = options.some((option) => option.value === savedValue)
    ? savedValue
    : DEFAULT_CORRECT_SOUND

  correctSoundEl.value = validValue
  correctSoundEl.disabled = false

  correctSoundEl.addEventListener("change", () => {
    saveCorrectSound(correctSoundEl.value || DEFAULT_CORRECT_SOUND)
    if (typeof renderStudyRecord === "function") {
      renderStudyRecord()
    }
  })
}

playCorrectSound = async function () {
  try {
    const correctSoundEl = document.getElementById("correct-sound")
    const preset = correctSoundEl?.value || getSavedCorrectSound()

    if (preset === "none") {
      return
    }

    if (preset === "pingpong") {
      await playPresetPingPong()
      return
    }

    if (preset === "levelup") {
      await playPresetLevelUp()
      return
    }

    if (preset === "softbell") {
      await playPresetSoftBell()
      return
    }

    await playPresetKirarin()
  } catch (error) {
    console.error("correct sound error", error)
  }
}

installCorrectSoundSelector()
