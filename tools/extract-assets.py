#!/usr/bin/env python3
"""Reproduce original assets without executing the DOS game.
Usage: python3 tools/extract-assets.py /path/to/tankwars [--bios-font /path/FONT8.BIN]
"""
import argparse, binascii, hashlib, json, struct, zlib
from pathlib import Path
parser=argparse.ArgumentParser();parser.add_argument('source',type=Path);parser.add_argument('--bios-font',type=Path);args=parser.parse_args()
root=Path(__file__).resolve().parents[1];out=root/'dist/assets';out.mkdir(parents=True,exist_ok=True)
exe=(args.source/'BOMB.EXE').read_bytes()
expected='659ace6b9a97c30191a8f65cf25f22322c087166909e9fa1d522e529adbafd9d'
if hashlib.sha256(exe).hexdigest()!=expected:raise SystemExit('This extractor is for the verified local Tank Wars 3.2 build only.')
def chunk(t,b):return struct.pack('>I',len(b))+t+b+struct.pack('>I',binascii.crc32(t+b)&0xffffffff)
def png(name,rgb):
 data=b''.join(b'\0'+rgb[y*960:(y+1)*960] for y in range(200))
 (out/name).write_bytes(b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',320,200,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(data))+chunk(b'IEND',b''))
a=(args.source/'BOMB1.RAW').read_bytes();b=(args.source/'BOMB2.RAW').read_bytes()
for i,raw in enumerate([a,b],1):
 assert len(raw)==64768
 pal=[round(x*255/63) for x in raw[64000:]]
 png(f'title-{i}.png',bytes(c for k in raw[:64000] for c in pal[k*3:k*3+3]))
rgb=bytearray()
for i in range(64000):
 raw=b if b[i] else a;k=raw[i];rgb.extend(round(n*255/63) for n in raw[64000+k*3:64003+k*3])
png('title.png',rgb)
# Parse each original CHR glyph, then check the research export against the bytes.
for name in ['tiny','litt','euro']:
 source=root/f'research/{name}-font-extracted.json';font=json.loads(source.read_text());header=int(font['headerOffset'],16)
 count=struct.unpack_from('<H',exe,header+1)[0];first=exe[header+4];data=header+struct.unpack_from('<H',exe,header+5)[0]
 def signed7(n):
  n&=127
  return n-128 if n>=64 else n
 for i in range(count):
  pos=data+struct.unpack_from('<H',exe,header+16+i*2)[0];commands=[]
  for j in range(2048):
   x,y=exe[pos],exe[pos+1];pos+=2
   if not x&128:break
   commands.append(['line' if y&128 else 'move',signed7(x),signed7(y)])
  glyph={'width':exe[header+16+count*2+i],'commands':commands}
  assert font['glyphs'][chr(first+i)]==glyph,(name,first+i)
 (out/f'{name}-font.json').write_bytes(source.read_bytes())
weapons=json.loads((root/'research/weapons-extracted.json').read_text())
for w in weapons['weapons']:
 offset=int(w['nameOffset'],16);assert exe[offset+1:offset+1+exe[offset]].decode('ascii')==w['name']
 assert struct.unpack_from('<i',exe,int(w['priceOffset'],16))[0]==w['price']
 assert struct.unpack_from('<H',exe,int(w['quantityOffset'],16))[0]==w['quantity']
(out/'weapons.json').write_text(json.dumps(weapons,indent=2)+'\n')
if args.bios_font:
 data=args.bios_font.read_bytes();assert len(data)==1024;(out/'font8.bin').write_bytes(data)
print('Verified original hash, weapon table, decoded title images and installed extracted fonts.')
