using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
class RedBox {
  static void Main(string[] args) {
    using (var bmp = new Bitmap(args[0])) {
      var bd = bmp.LockBits(new Rectangle(0,0,bmp.Width,bmp.Height), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
      int stride = bd.Stride;
      byte[] pix = new byte[stride * bmp.Height];
      Marshal.Copy(bd.Scan0, pix, 0, pix.Length);
      bmp.UnlockBits(bd);
      int minx=bmp.Width, miny=bmp.Height, maxx=0, maxy=0, n=0;
      // sample the red stroke: high R, low G, low B
      for (int y=0; y<bmp.Height; y++) {
        for (int x=0; x<bmp.Width; x++) {
          int i=y*stride+x*4;
          int b=pix[i], g=pix[i+1], r=pix[i+2];
          if (r>200 && g<80 && b<80 && r-g>120) {
            n++;
            if (x<minx) minx=x; if (y<miny) miny=y; if (x>maxx) maxx=x; if (y>maxy) maxy=y;
          }
        }
      }
      Console.WriteLine("size {0}x{1} red {2} box {3},{4} {5}x{6}", bmp.Width, bmp.Height, n, minx, miny, maxx-minx, maxy-miny);
      Console.WriteLine("frac L={0:F3} T={1:F3} R={2:F3} B={3:F3}",
        (double)minx/bmp.Width, (double)miny/bmp.Height, (double)maxx/bmp.Width, (double)maxy/bmp.Height);
      // also print a few y-slices of leftmost/rightmost red to see the shape
      for (int y=miny; y<=maxy; y+=Math.Max(1,(maxy-miny)/12)) {
        int lx=-1, rx=-1;
        for (int x=0; x<bmp.Width; x++) {
          int i=y*stride+x*4;
          int b=pix[i], g=pix[i+1], r=pix[i+2];
          if (r>200 && g<80 && b<80 && r-g>120) { if (lx<0) lx=x; rx=x; }
        }
        if (lx>=0) Console.WriteLine("y={0:F3} x={1:F3}-{2:F3}", (double)y/bmp.Height, (double)lx/bmp.Width, (double)rx/bmp.Width);
      }
    }
  }
}
