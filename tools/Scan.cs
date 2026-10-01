using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
class Scan {
  static void Main() {
    using (var bmp = new Bitmap(@"C:\Users\dufala.DESKTOP-28S4BRA\草原\assets\ui\panel.png")) {
      var bd = bmp.LockBits(new Rectangle(0,0,bmp.Width,bmp.Height), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
      int stride = bd.Stride;
      byte[] pix = new byte[stride * bmp.Height];
      Marshal.Copy(bd.Scan0, pix, 0, pix.Length);
      bmp.UnlockBits(bd);
      bool inn = false; int y0=0,x0=0,x1=0,i0=9999,i1=-1;
      for (int y=0; y<bmp.Height; y++) {
        int bn=0, bx0=9999, bx1=-1, in0=9999, in1=-1;
        for (int x=180; x<1060; x++) {
          int i = y*stride + x*4;
          int b=pix[i], g=pix[i+1], r=pix[i+2], a=pix[i+3];
          bool bar = a>200 && r>190 && r<245 && g>175 && g<230 && b>155 && b<215 && (r-b)>20;
          bool ink = a>200 && r<90 && g<80 && b<70;
          if (bar) { bn++; if (x<bx0) bx0=x; if (x>bx1) bx1=x; }
          if (ink) { if (x<in0) in0=x; if (x>in1) in1=x; }
        }
        bool hit = bn>40;
        if (hit && !inn) { inn=true; y0=y; x0=bx0; x1=bx1; i0=in0; i1=in1; }
        else if (hit && inn) {
          if (bx0<x0) x0=bx0; if (bx1>x1) x1=bx1;
          if (in0<i0) i0=in0; if (in1>i1) i1=in1;
        } else if (!hit && inn) {
          Console.WriteLine("bar y={0}-{1} x={2}-{3} ink x={4}-{5}", y0, y-1, x0, x1, i0, i1);
          inn=false;
        }
      }
    }
  }
}
