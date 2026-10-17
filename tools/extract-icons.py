#!/usr/bin/env python3
"""Extract procedural weapon icon draw calls from the verified Tank Wars 3.2 OVR.
No DOS/emulator needed. Decodes only the straight-line x86 instructions in each
case arm; unknown instructions or unexpected call signatures are fatal.
"""
import argparse, hashlib, json, struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SHA = '8186d7d4190350992a2a1b7036d9ba62cc4e300c3e9fd3ce901eddbcad5b466f'
RANGES = [(0x1d3e4,0x1d3f8),(0x1d400,0x1d411),(0x1d419,0x1d43e),
 (0x1d446,0x1d485),(0x1d48d,0x1d4e1),(0x1d4e9,0x1d53c),
 (0x1d544,0x1d594),(0x1d59f,0x1d743),(0x1d74e,0x1d7ee),
 (0x1d7f9,0x1d989),(0x1d994,0x1db24),(0x1db2c,0x1db80),
 (0x1db88,0x1dbf1),(0x1dbf9,0x1dc4d),(0x1dc55,0x1dc94),
 (0x1dc9f,0x1dd32),(0x1dd3d,0x1de5c),(0x1de67,0x1df49)]
CALLS = {0x1fe4:('pixel',3), 0x11ea:('circle',3), 0x1c86:('line',4),0x1cce:('bar',4)}

def calls(b, start, end, icon):
    pc, ax, stack, ops = start, 0, [], []
    while pc < end:
        op=b[pc]
        if op==0xb8: ax=struct.unpack_from('<h',b,pc+1)[0];pc+=3
        elif op==0xa1:
            assert b[pc+1:pc+3]==b'\x40\x47'; ax=icon;pc+=3
        elif op==0x05: ax+=struct.unpack_from('<h',b,pc+1)[0];pc+=3
        elif b[pc:pc+2] in (b'\x33\xc0', b'\x31\xc0'): ax=0;pc+=2
        elif op==0x50: stack.append(ax);pc+=1
        elif op==0x9a:
            offset,seg=struct.unpack_from('<HH',b,pc+1);assert seg==0xe26
            name,n=CALLS[offset];assert len(stack)==n,(hex(pc),stack)
            if name=='pixel':assert stack[-1]==100+icon;stack.pop()
            ops.append({'op':name,'args':stack,'ovr':hex(pc)});stack=[];pc+=5
        else: raise ValueError(f'Unexpected opcode {op:02x} at {pc:x}')
    assert pc==end and not stack
    return ops

def raster(ops, font):
    pixels=set()
    def put(x,y):
        if 0<=x<15 and 0<=y<10:pixels.add((x,y))
    def line(x,y,xx,yy):
        dx=abs(xx-x);sx=1 if x<xx else -1;dy=-abs(yy-y);sy=1 if y<yy else -1;e=dx+dy
        while True:
            put(x,y)
            if (x,y)==(xx,yy):break
            e2=e*2
            if e2>=dy:e+=dy;x+=sx
            if e2<=dx:e+=dx;y+=sy
    for op in ops:
        a=op['args'];kind=op['op']
        if kind=='pixel':put(*a)
        elif kind=='line':line(*a)
        elif kind=='bar':
            x0,y0,x1,y1=a
            for y in range(min(y0,y1),max(y0,y1)+1):
                for x in range(min(x0,x1),max(x0,x1)+1):put(x,y)
        elif kind=='circle':
            x,y,r=a;assert r==1
            for dx,dy in [(0,-1),(-1,0),(1,0),(0,1)]:put(x+dx,y+dy)
        elif kind=='text':
            x,y,char=a
            # BGI centered BIOS text: x - (width//2 - 1), y - height//2.
            # EXE 0x130ae..0x130fa. Original outtextxy center is (7,6).
            x-=3;y-=4
            for row in range(8):
                for col in range(8):
                    if font[ord(char)*8+row] & (128>>col):put(x+col,y+row)
        else:raise ValueError(kind)
    return [''.join('1' if (x,y) in pixels else '0' for x in range(15)) for y in range(10)]

def main():
    parser=argparse.ArgumentParser();parser.add_argument('original',nargs='?',type=Path,default=ROOT/'research/original');parser.add_argument('--bios-font',type=Path,default=ROOT/'dist/assets/font8.bin');parser.add_argument('--output',type=Path,default=ROOT/'research/icons-extracted.json');parser.add_argument('--verify-screenshot',type=Path);args=parser.parse_args()
    b=(args.original/'BOMB.OVR').read_bytes();assert hashlib.sha256(b).hexdigest()==SHA
    font=args.bios_font.read_bytes();assert len(font)==1024
    names=[x['name'] for x in json.loads((ROOT/'research/weapons-extracted.json').read_text())['weapons']]
    names+=['Herb\'s Guidance System','Vick\'s Guidance System'];icons=[]
    for i in range(20):
        if i<18:start,end=RANGES[i];ops=calls(b,start,end,i)
        else:
            start,end=(0x1df50,0x1df79) if i==18 else (0x1df80,0x1dfa9)
            char='H' if i==18 else 'V';assert b[0x1d324+(i-18)*2:0x1d326+(i-18)*2]==bytes([1,ord(char)])
            ops=[{'op':'text','args':[7,6,char],'font':'BIOS8x8','justify':[1,1],'ovr':hex(0x1df74 if i==18 else 0x1dfa4)}]
        rows=raster(ops,font)
        framed=[ ''.join('1' if y==0 or x in(0,14) else rows[y][x] for x in range(15)) for y in range(10)]
        icons.append({'id':i,'name':names[i],'sourceRange':[hex(start),hex(end)],'paletteIndex':100+i,'ops':ops,'contentRows':rows,'rows':framed})
    result={'source':{'file':'BOMB.OVR','sha256':SHA,'routine':['0x1d328','0x1dfdc'],'biosFontSha256':hashlib.sha256(font).hexdigest()},'width':15,'height':10,'toolbar':{'x':10,'y':18,'stride':15,'viewport':[0,0,15,9],'rectangle':[0,0,14,10],'clip':True},'colorsVGA6':{'available':[63,63,63],'selected':[63,0,0],'unavailable':[0,0,0]},'icons':icons}
    args.output.write_text(json.dumps(result,indent=2)+'\n');print(f'Extracted {len(icons)} icons to {args.output}')
    if args.verify_screenshot:
        # Optional reference QA uses Pillow only; extraction uses stdlib alone.
        from PIL import Image
        im=Image.open(args.verify_screenshot).convert('RGB')
        assert im.size==(1920,1496), 'Expected archived DOSBox reference capture'
        for icon in icons:
            def sample(x,y):
                return im.getpixel((int((10+15*icon['id']+x+.5)*6),int(56+(18+y+.5)*7.2)))
            bright=max(sample(0,0))>128
            rows=[''.join('1' if (sample(x,y)[0]>128 if bright else max(sample(x,y))<25) else '0' for x in range(15)) for y in range(10)]
            assert rows==icon['rows'], f"Reference mismatch for icon {icon['id']}"
        print('Reference raster verification: 20 icons, 3000/3000 pixels match.')
if __name__=='__main__':main()
