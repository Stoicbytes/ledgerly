"""Home-screen icons for the web app (public/icons), made from the app icon in assets/.

Run from apps/command-center after changing assets/icon.png or the Android icon layers:
    python3 scripts/make-web-icons.py        (needs Pillow)
"""
from PIL import Image

icon = Image.open("assets/icon.png").convert("RGB")
for size, name in [(192, "icon-192"), (512, "icon-512"), (180, "apple-touch-icon")]:
    icon.resize((size, size), Image.LANCZOS).save(f"public/icons/{name}.png", optimize=True)

# Maskable: the Android adaptive-icon layers, whose artwork already sits in the safe zone.
background = Image.open("assets/android-icon-background.png").convert("RGBA")
foreground = Image.open("assets/android-icon-foreground.png").convert("RGBA")
maskable = Image.alpha_composite(background.resize((512, 512)), foreground.resize((512, 512)))
maskable.convert("RGB").save("public/icons/icon-maskable-512.png", optimize=True)
