# config.py

GENRE_PROMPTS = {
    "cyberpunk": "Write a gritty, neon-soaked cyberpunk sci-fi story. Incorporate elements of high technology, cybernetics, virtual networks, and rain-slicked city streets.",
    "fantasy": "Write an epic high-fantasy story. Incorporate elements of magic, sorcery, ancient ruins, mythical beasts, and legendary swords.",
    "noir": "Write a hardboiled noir detective mystery. Incorporate elements of trench coats, deep shadows, rainy alleyways, trenchant cynicism, and detective deduction.",
    "horror": "Write a chilling, atmospheric gothic horror story. Incorporate elements of ancient curses, eerie whispers, creeping shadows, decayed castles, and dread.",
    "adventure": "Write a classic, high-spirited heroic adventure story. Incorporate elements of hidden treasures, rugged explorations, daring escapes, and ancient ruins."
}

VOICE_MAP = {
    "adam": "pNInz6obpgDQGcFmaJgB",
    "rachel": "21m00Tcm4TlvDq8ikWAM",
    "antoni": "ErXwobaYiN019PkySvjV",
    "bella": "EXAVITQu4vr4xnSDxMaL"
}

FALLBACK_ACCENTS = {
    "adam": ("en", "co.uk"),
    "rachel": ("en", "com"),
    "antoni": ("en", "co.in"),
    "bella": ("en", "ca")
}

CURATED_BGM = {
    "synthwave": "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Volatile%20Reaction.mp3",
    "dark_ambient": "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Sinister%20Dark.mp3",
    "lofi": "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Enchanted%20Valley.mp3",
    "noir": "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Leaving%20Home.mp3",
    "orchestral": "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Lord%20of%20the%20Land.mp3"
}

POLLINATIONS_CONFIGS = [
    ("https://image.pollinations.ai/prompt", "flux"),
    ("https://pollinations.ai/p", "turbo"),
    ("https://image.pollinations.ai/prompt", "flux-realism"),
    ("https://pollinations.ai/p", "any-dark"),
    ("https://image.pollinations.ai/prompt", "default")
]
