#!/usr/bin/env python3
"""Sinh ảnh minh họa SVG cho 15 địa điểm -> apps/web/public/places/<code>.svg (chạy: python3 scripts/gen-place-art.py)"""
import random, os
OUT = os.path.join(os.path.dirname(__file__), '..', 'apps/web/public/places')
os.makedirs(OUT, exist_ok=True)
W, H = 800, 500
WALL, ROOF, WOOD, RED, TEAL = '#e3a92f', '#7a4a2a', '#4e2a17', '#b5292b', '#1f4e5f'

def lantern(x, y, s=1, c=RED):
    return (f'<line x1="{x}" y1="{y-30*s}" x2="{x}" y2="{y-14*s}" stroke="#3a2415" stroke-width="2"/>'
            f'<ellipse cx="{x}" cy="{y}" rx="{13*s}" ry="{16*s}" fill="{c}"/>'
            f'<ellipse cx="{x}" cy="{y}" rx="{13*s}" ry="{16*s}" fill="url(#glow)"/>'
            f'<rect x="{x-6*s}" y="{y-18*s}" width="{12*s}" height="{4*s}" fill="#e8b931"/>'
            f'<rect x="{x-6*s}" y="{y+14*s}" width="{12*s}" height="{4*s}" fill="#e8b931"/>'
            f'<line x1="{x}" y1="{y+18*s}" x2="{x}" y2="{y+30*s}" stroke="#e8b931" stroke-width="2"/>')

def roof(x, y, w, h, col=ROOF, up=True):
    k = 18 if up else 6
    tiles = ''.join(f'<path d="M{x+i*14} {y+h} L{x+w*0.2+i*(w*0.6/(w//14))} {y}" stroke="#00000022" stroke-width="2"/>' for i in range(0, w//14))
    return (f'<path d="M{x-k} {y+h} Q{x+10} {y+h-6} {x+w*0.1} {y+h*0.45} L{x+w*0.2} {y} L{x+w*0.8} {y} L{x+w*0.9} {y+h*0.45} Q{x+w-10} {y+h-6} {x+w+k} {y+h} Z" fill="{col}"/>'
            f'{tiles}<rect x="{x+w*0.2}" y="{y-5}" width="{w*0.6}" height="7" rx="3" fill="#00000033"/>')

def window(x, y, w, h):
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="#3a2415"/><rect x="{x+4}" y="{y+4}" width="{w/2-6}" height="{h-8}" fill="#2f6b5a"/><rect x="{x+w/2+2}" y="{y+4}" width="{w/2-6}" height="{h-8}" fill="#2f6b5a"/>'

def sky(kind):
    stops = {'day': ('#79c4ea', '#fbe9bd'), 'dusk': ('#2b2a5e', '#f0905a'), 'night': ('#10143a', '#6a2c62')}[kind]
    sun = '<circle cx="640" cy="120" r="46" fill="#ffe9a6" opacity=".85"/>' if kind == 'day' else ''
    if kind == 'night':
        sun = ''.join(f'<circle cx="{random.randint(20,780)}" cy="{random.randint(10,200)}" r="1.6" fill="#fff" opacity=".8"/>' for _ in range(40)) + '<circle cx="660" cy="90" r="30" fill="#fff3c4"/>'
    return (f'<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{stops[0]}"/><stop offset="1" stop-color="{stops[1]}"/></linearGradient>'
            '<radialGradient id="glow"><stop offset="0" stop-color="#ffd36b" stop-opacity=".9"/><stop offset="1" stop-color="#ffd36b" stop-opacity="0"/></radialGradient></defs>'
            f'<rect width="{W}" height="{H}" fill="url(#sky)"/>{sun}')

def river(y=380, night=False):
    c = '#16305a' if night else '#3f8f9a'
    rip = ''.join(f'<rect x="{random.randint(0,720)}" y="{random.randint(y+10,H-10)}" width="{random.randint(40,110)}" height="3" rx="1.5" fill="#fff" opacity=".25"/>' for _ in range(14))
    return f'<rect y="{y}" width="{W}" height="{H-y}" fill="{c}"/>{rip}'

def street(y=410):
    return f'<rect y="{y}" width="{W}" height="{H-y}" fill="#b98d5a"/><rect y="{y}" width="{W}" height="8" fill="#00000022"/>'

def flowers(x, y, r=60):
    return ''.join(f'<circle cx="{x+random.randint(-r,r)}" cy="{y+random.randint(-r//2,r//2)}" r="{random.randint(14,26)}" fill="{random.choice(["#d6336c","#e64980","#f06595"])}"/>' for _ in range(14)) + f'<circle cx="{x}" cy="{y+20}" r="{r*0.7}" fill="#2f7a4a" opacity=".85"/>'

def shophouse(x, w=250, wall=WALL, floors=2, rf=ROOF):
    top = 150
    s = roof(x - 10, top, w + 20, 52, rf)
    s += f'<rect x="{x}" y="{top+50}" width="{w}" height="{410-top-50}" fill="{wall}"/>'
    s += f'<rect x="{x}" y="{top+50}" width="{w}" height="10" fill="#00000026"/>'
    n = max(2, w // 90)
    for i in range(n):
        s += window(x + 22 + i * (w - 44) / n + 6, top + 82, 40, 66)
    s += f'<rect x="{x}" y="{top+168}" width="{w}" height="12" fill="{WOOD}"/>'
    s += f'<rect x="{x+w/2-34}" y="{top+196}" width="68" height="{410-top-196}" fill="{WOOD}"/><rect x="{x+w/2-26}" y="{top+204}" width="52" height="{410-top-204}" fill="#2a160c"/>'
    s += lantern(x + 30, top + 205) + lantern(x + w - 30, top + 205, c='#e8a010')
    return s

def gate(x, w, col, wall=RED, h=150):
    s = f'<rect x="{x}" y="{410-h}" width="{w}" height="{h}" fill="{wall}"/>'
    s += roof(x - 20, 410 - h - 62, w + 40, 66, col)
    s += ''.join(f'<circle cx="{x+w*f}" cy="{410-h-66}" r="7" fill="#e8b931"/>' for f in (0.12, 0.88)) + f'<path d="M{x+w/2-18} {410-h-70} q18 -26 36 0 z" fill="#e8b931"/>'
    s += f'<rect x="{x+w/2-w*0.18}" y="{410-h*0.72}" width="{w*0.36}" height="{h*0.72}" rx="{w*0.18}" fill="#2a160c"/>'
    s += f'<rect x="{x+w/2-34}" y="{410-h-8}" width="68" height="24" fill="#2a160c"/><rect x="{x+w/2-30}" y="{410-h-4}" width="60" height="16" fill="#e8b931"/>'
    s += ''.join(f'<rect x="{x+w*f-6}" y="{410-h}" width="12" height="{h}" fill="{WOOD}"/>' for f in (0.1, 0.9))
    return s

def scene(code):
    random.seed(code)
    night = code == 'cho-dem-an-hoi'
    kind = 'night' if night else ('dusk' if code in ('hoi-quan-quang-dong', 'quan-cong-mieu') else 'day')
    o = sky(kind)
    if code == 'chua-cau':
        o += river(360) + '<rect x="120" y="300" width="560" height="70" fill="#8d7b6a"/>' + ''.join(f'<path d="M{150+i*170} 370 v-30 a40 40 0 0 1 80 0 v30z" fill="#2c2a2a"/>' for i in range(3))
        o += f'<rect x="130" y="228" width="540" height="72" fill="{WOOD}"/>' + ''.join(f'<rect x="{140+i*34}" y="248" width="6" height="52" fill="#a8683b"/>' for i in range(16))
        o += roof(110, 150, 580, 82, '#6e4328') + '<path d="M380 150 q20 -34 40 0z" fill="#e8b931"/>' + flowers(70, 300) + flowers(740, 310) + lantern(260, 262, .8) + lantern(540, 262, .8)
        o += '<rect x="130" y="370" width="540" height="40" fill="#00000022"/>'
    elif code.startswith('nha-co') or code == 'bao-tang-hoi-an':
        o += street() + shophouse(120, 260, WALL if code != 'nha-co-tan-ky' else '#d98f2a')
        o += shophouse(420, 250, random.choice(['#e8b940', '#cf8a30', '#e6a63a']), rf='#6b3b1f') + flowers(700, 330, 40) + lantern(400, 250, .9, '#e8a010')
        if code == 'bao-tang-hoi-an': o += '<rect x="250" y="300" width="300" height="46" rx="4" fill="#1f4e5f"/><rect x="260" y="308" width="280" height="30" fill="none" stroke="#e8b931" stroke-width="2"/>'
    elif code == 'nha-tho-toc-tran':
        o += street() + f'<rect x="170" y="230" width="460" height="180" fill="#d8b678"/>' + roof(150, 150, 500, 84, '#6b4a34') + ''.join(f'<rect x="{230+i*125}" y="270" width="70" height="140" fill="{WOOD}"/><rect x="{238+i*125}" y="278" width="54" height="132" fill="#2a160c"/>' for i in range(3))
        o += '<rect x="372" y="236" width="56" height="26" fill="#b5292b"/>' + lantern(200, 300) + lantern(600, 300) + '<circle cx="90" cy="290" r="60" fill="#2f7a4a"/><rect x="84" y="320" width="12" height="90" fill="#4e2a17"/>'
    elif code.startswith('hoi-quan'):
        col = {'hoi-quan-quang-dong': '#2e8b78', 'hoi-quan-phuc-kien': '#b5292b', 'hoi-quan-hai-nam': '#2f5f8a', 'hoi-quan-trieu-chau': '#c9971c'}[code]
        o += street() + gate(200, 400, col) + '<rect x="120" y="270" width="80" height="140" fill="#c46b3a"/>' + roof(110, 230, 100, 44, col, False) + '<rect x="600" y="270" width="80" height="140" fill="#c46b3a"/>' + roof(590, 230, 100, 44, col, False)
        o += lantern(250, 300, 1) + lantern(550, 300, 1, '#e8a010') + '<path d="M60 410 v-90 a50 50 0 0 1 80 -30" stroke="#2f7a4a" stroke-width="10" fill="none"/>'
    elif code == 'quan-cong-mieu':
        o += street() + gate(220, 360, '#8a2a22', '#a8302a', 160) + '<rect x="250" y="130" width="300" height="40" fill="#8a2a22"/>' + ''.join(f'<g><circle cx="{300+i*50}" cy="205" r="14" fill="none" stroke="#c9971c" stroke-width="3"/><circle cx="{300+i*50}" cy="205" r="6" fill="none" stroke="#c9971c" stroke-width="2"/></g>' for i in range(5)) + lantern(160, 260, 1.1) + lantern(640, 260, 1.1)
    elif code.startswith('bao-tang'):
        o += street() + '<rect x="130" y="230" width="540" height="180" fill="#efe3cc"/><path d="M110 232 L400 130 L690 232 Z" fill="#a8683b"/><circle cx="400" cy="195" r="18" fill="#e8b931"/>' + ''.join(f'<rect x="{160+i*100}" y="250" width="28" height="160" fill="#fff6e2"/>' for i in range(6))
        jar = (lambda x, c: f'<path d="M{x} 410 q-34 -10 -30 -44 q2 -24 20 -34 h20 q18 10 20 34 q4 34 -30 44z" fill="{c}"/><rect x="{x-14}" y="322" width="28" height="10" rx="4" fill="#00000033"/>')
        col = '#8a5a3a' if code == 'bao-tang-sa-huynh' else '#2f6f9f'
        o += jar(200, col) + jar(400, col) + jar(600, col)
        if code == 'bao-tang-gom-su': o += ''.join(f'<path d="M{x-16} 372 h32 M{x-18} 384 h36" stroke="#fff" stroke-width="3"/>' for x in (200, 400, 600))
    elif code == 'cho-hoi-an':
        o += street(390)
        for i in range(4):
            x = 60 + i * 180
            c = ['#b5292b', '#e8b931', '#2f7a4a', '#1f4e5f'][i]
            o += f'<path d="M{x} 250 h160 l14 60 h-188z" fill="{c}"/>' + ''.join(f'<rect x="{x+j*20}" y="250" width="10" height="60" fill="#ffffff55"/>' for j in range(8)) + f'<rect x="{x+6}" y="310" width="8" height="90" fill="{WOOD}"/><rect x="{x+146}" y="310" width="8" height="90" fill="{WOOD}"/>'
            o += f'<rect x="{x+10}" y="360" width="140" height="40" fill="#8a5a3a"/>' + ''.join(f'<circle cx="{x+24+k*22}" cy="356" r="11" fill="{random.choice(["#e63946","#f4a261","#8ac926","#ffca3a"])}"/>' for k in range(6))
            o += f'<path d="M{x+80} 262 l-22 34 h44z" fill="#e6c27a" stroke="#a8683b" stroke-width="2"/>'
    elif code == 'cho-dem-an-hoi':
        o += river(350, True) + '<rect x="0" y="260" width="800" height="100" fill="#2a1c3a"/>' + ''.join(f'<rect x="{20+i*90}" y="{275+(i%2)*14}" width="30" height="34" fill="#ffd36b"/>' for i in range(9))
        o += ''.join(lantern(40 + i * 50, 150 + (i % 3) * 26 + int(26 * ((i % 8) / 8)), 1, random.choice([RED, '#e8a010', '#e64980', '#2fa7b5', '#8ac926'])) for i in range(16))
        o += '<path d="M240 400 q160 40 320 0 l-30 36 h-260z" fill="#3a2415"/><path d="M400 400 v-70 l50 70z" fill="#e8b931"/>' + ''.join(f'<ellipse cx="{300+i*70}" cy="460" rx="14" ry="5" fill="#ffd36b" opacity=".6"/>' for i in range(5))
    o += f'<rect width="{W}" height="{H}" fill="url(#vig)" opacity=".0"/>'
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMid slice" role="img">{o}</svg>'

CODES = 'chua-cau nha-co-phung-hung hoi-quan-quang-dong bao-tang-sa-huynh nha-co-tan-ky nha-co-quan-thang bao-tang-gom-su nha-tho-toc-tran hoi-quan-phuc-kien quan-cong-mieu cho-hoi-an hoi-quan-hai-nam hoi-quan-trieu-chau bao-tang-hoi-an cho-dem-an-hoi'.split()
for c in CODES:
    open(os.path.join(OUT, c + '.svg'), 'w', encoding='utf-8').write(scene(c))
print('OK', len(CODES), 'ảnh')
