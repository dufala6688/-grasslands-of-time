using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
class Chip {
  static void Main() {
    string[] files = {
      @"C:\Users\dufala.DESKTOP-28S4BRA\草原\assets\ui\chip-cow-trim.png",
      @"C:\Users\dufala.DESKTOP-28S4BRA\草原\assets\ui\chip-sheep-trim.png",
      @"C:\Users\dufala.DESKTOP-28S4BRA\草原\assets\ui\chip-grass-trim.png",
      @"C:\Users\dufala.DESKTOP-28S4BRA\草原\assets\ui\chip-dog-trim.png"
    };
    foreach (var f in files) {
      using (var bmp = new Bitmap(f)) {
        var bd = bmp.LockBits(new Rectangle(0,0,bmp.Width,bmp.Height), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
        int stride = bd.Stride;
        byte[] pix = new byte[stride * bmp.Height];
        Marshal.Copy(bd.Scan0, pix, 0, pix.Length);
        bmp.UnlockBits(bd);
        int x0=9999,x1=-1,y0=9999,y1=-1;
        // ink on the right half, lower half (the x0), skip icon
        int mid = bmp.Width * 42 / 100;
        for (int y=bmp.Height/2; y<bmp.Height-2; y++) {
          for (int x=mid; x<bmp.Width-4; x++) {
            int i=y*stride+x*4;
            if (pix[i+3]>180 && pix[i+2]<90 && pix[i+1]<80 && pix[i]<70) {
              if (x<x0) x0=x; if (x>x1) x1=x; if (y<y0) y0=y; if (y>y1) y1=y;
            }
          }
        }
        // sample cream near the x0
        int si = (y0+4)*stride + (x1+6)*4;
        Console.WriteLine("{0} {1}x{2} x0box {3},{4} {5}x{6} cream {7},{8},{9}",
          System.IO.Path.GetFileName(f), bmp.Width, bmp.Height, x0, y0, x1-x0+1, y1-y0+1,
          pix[si+2], pix[si+1], pix[si]);
        Console.WriteLine("  pct L={0:F1} T={1:F1} W={2:F1} H={3:F1}",
          100.0*x0/bmp.Width, 100.0*y0/bmp.Height, 100.0*(x1-x0+8)/bmp.Width, 100.0*(y1-y0+6)/bmp.Height);
      }
    }
  }
}
