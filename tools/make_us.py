"""Впечатывает в УЗИ-снимки спрятанные цели: сердечко (комната 1) и носочек (комната 2)."""
import math
import random

from PIL import Image, ImageDraw, ImageFilter

SS = 8  # суперсэмплинг маски


def heart_mask(w):
    h = int(w * 0.92)
    W, H = w * SS, h * SS
    m = Image.new('L', (W, H), 0)
    pts = []
    for i in range(200):
        t = i / 200 * 2 * math.pi
        x = 16 * math.sin(t) ** 3
        y = 13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t)
        pts.append((W / 2 + x / 17 * W / 2, H * 0.42 - y / 17 * H / 2 * 1.05))
    ImageDraw.Draw(m).polygon(pts, fill=255)
    return m.resize((w, h), Image.LANCZOS)


def sock_mask(w):
    h = int(w * 1.15)
    W, H = w * SS, h * SS
    m = Image.new('L', (W, H), 0)
    d = ImageDraw.Draw(m)
    lw = W * 0.42
    d.rounded_rectangle((W * 0.08, 0, W * 0.08 + lw, H * 0.82), radius=W * 0.08, fill=255)          # голенище
    d.rounded_rectangle((W * 0.08, H * 0.56, W * 0.98, H * 0.98), radius=H * 0.2, fill=255)        # стопа
    d.rectangle((W * 0.06, 0, W * 0.08 + lw + W * 0.02, H * 0.13), fill=255)                        # резинка
    m = m.rotate(-12, resample=Image.BICUBIC, expand=False)
    return m.resize((w, h), Image.LANCZOS)


def stamp(img, mask, cx, cy, tone, alpha, seed):
    rnd = random.Random(seed)
    mask = mask.filter(ImageFilter.GaussianBlur(0.6))
    x0, y0 = int(cx - mask.width / 2), int(cy - mask.height / 2)
    px = img.load()
    mk = mask.load()
    for j in range(mask.height):
        for i in range(mask.width):
            a = mk[i, j] / 255 * alpha
            if a <= 0:
                continue
            v = tone + rnd.gauss(0, 28)                      # спекл-помехи внутри фигуры
            if rnd.random() < 0.08:
                v += rnd.choice((-60, 60))
            o = px[x0 + i, y0 + j]
            px[x0 + i, y0 + j] = int(max(0, min(255, o * (1 - a) + v * a)))
    return x0, y0


def main():
    a = Image.open('1_2.PNG').convert('L')
    stamp(a, heart_mask(26), 777, 335, tone=28, alpha=0.58, seed=1)
    a.save('webapp/img/room1_us.jpg', quality=88, optimize=True)

    b = Image.open('2_2.PNG').convert('L')
    stamp(b, sock_mask(26), 866, 288, tone=200, alpha=0.4, seed=2)
    b.save('webapp/img/room2_us.jpg', quality=88, optimize=True)


if __name__ == '__main__':
    main()
