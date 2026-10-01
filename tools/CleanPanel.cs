using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
class CleanPanel {
  static void Main() {
    string src = @"C:\Users\dufala.DESKTOP-28S4BRA\草原\assets\ui\panel.png";
    string dst = @"C:\Users\dufala.DESKTOP-28S4BRA\草原\assets\ui\panel-clean.png";
    using (var bmp = new Bitmap(src)) {
      var bd = bmp.LockBits(new Rectangle(0,0,bmp.Width,bmp.Height), ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
      int stride = bd.Stride;
      byte[] pix = new byte[stride * bmp.Height];
      Marshal.Copy(bd.Scan0, pix, 0, pix.Length);
      // cover baked tracks and the 0/10 column with the card color just above each row
      int[][] rows = new int[][]{
        new[]{248, 250, 1046, 316},
        new[]{248, 604, 1046, 670},
        new[]{248, 950, 1046, 1018}
      };
      foreach (var row in rows) {
        int x0=row[0], y0=row[1], x1=row[2], y1=row[3];
        int si = (y0 - 18) * stride + 430 * 4;
        byte bb=pix[si], gg=pix[si+1], rr=pix[si+2], aa=255;
        for (int y=y0; y<=y1; y++) {
          for (int x=x0; x<=x1; x++) {
            int i=y*stride+x*4;
            pix[i]=bb; pix[i+1]=gg; pix[i+2]=rr; pix[i+3]=aa;
          }
        }
      }
      Marshal.Copy(pix, 0, bd.Scan0, pix.Length);
      bmp.UnlockBits(bd);
      bmp.Save(dst, ImageFormat.Png);
    }
    Console.WriteLine("wrote " + dst);
  }
}
