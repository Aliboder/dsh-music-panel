from PIL import Image
src = r'C:\Users\Aliboder\.dsh\attachments\v1\objects\e5\e5b10c6e00361231cd7a018fe4f964dfd0cce2fac17408b9f8890ab543d03070'
im = Image.open(src).convert('RGB')
px = im.load()
def verydark(x, y):
    r, g, b = px[x, y]
    return r + g + b < 150
for y in (1380, 1400, 1430, 1460):
    xs = [x for x in range(700, 2100) if verydark(x, y)]
    if xs:
        print('y', y, 'span', min(xs), max(xs), 'center', (min(xs)+max(xs))/2, 'count', len(xs))
    else:
        print('y', y, 'none')
# vertical extent at x=1000 and x=1500
for x in (1090, 1500, 1810):
    ys = [y for y in range(1300, 1528) if verydark(x, y)]
    print('x', x, 'ys', (min(ys), max(ys)) if ys else None)