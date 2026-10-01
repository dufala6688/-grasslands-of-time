using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
class B {
  static void Main() {
    string[] files = {
      @"C:\Users\dufala.DESKTOP-28S4BRA\草原\assets\ui\btn-help.png",
      @"C:\Users\dufala.DESKTOP-28S4BRA\草原\assets\ui\btn-sound.png",
      @"C:\Users\dufala.DESKTOP-28S4BRA\草原\assets\ui\btn-mute.png",
      @"C:\Users\dufala.DESKTOP-28S4BRA\草原\assets\ui\btn-leisure.png",
      @"C:\Users\dufala.DESKTOP-28S4BRA\草原\assets\ui\btn-leisure-on.png",
      @"C:\Users\dufala.DESKTOP-28S4BRA\草原\assets\ui\btn-reset.png"
    };
    foreach (var f in files) {
      using (var bmp = new Bitmap(f)) {
        var bd = bmp.LockBits(new Rectangle(0,0,bmp.Width,bmp.Height), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
        int stride = bd.Stride;
        byte[] pix = new byte[stride * bmp.Height];
        Marshal.Copy(bd.Scan0, pix, 0, pix.Length);
        bmp.UnlockBits(bd);
        int x0=bmp.Width,y0=bmp.Height,x1=-1,y1=-1;
        for (int y=0;y<bmp.Height;y++) for (int x=0;x<bmp.Width;x++) {
          if (pix[y*stride+x*4+3] > 20) {
            if (x<x0) x0=x; if (y<y0) y0=y; if (x>x1) x1=x; if (y>y1) y1=y;
          }
        }
        Console.WriteLine("{0} {1}x{2} content {3},{4} {5}x{6}", System.IO.Path.GetFileName(f), bmp.Width, bmp.Height, x0, y0, x1-x0+1, y1-y0+1);
      }
    }
  }
}
