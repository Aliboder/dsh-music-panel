from PIL import Image
src = r'C:\Users\Aliboder\.dsh\attachments\v1\objects\e5\e5b10c6e00361231cd7a018fe4f964dfd0cce2fac17408b9f8890ab543d03070'
im = Image.open(src).convert('RGB')
crop = im.crop((400, 1380, 2560, 1528)).resize((2160, 148), Image.LANCZOS)
crop.save(r'D:\SystemFiles\Documents\Project\DSH\plugins\dsh-music\A_other\_bottom.png')
print('ok')