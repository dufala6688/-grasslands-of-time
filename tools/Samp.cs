using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
class Samp {
  static void Main() {
    using (var bmp = new Bitmap(@"C:\Users\dufala.DESKTOP-28S4BRA\草原\assets\ui\panel.png")) {
      var bd = bmp.LockBits(new Rectangle(0,0,bmp.Width,bmp.Height), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
      int stride = bd.Stride;
      byte[] pix = new byte[stride * bmp.Height];
      Marshal.Copy(bd.Scan0, pix, 0, pix.Length);
      bmp.UnlockBits(bd);
      foreach (int y in new int[]{283, 636, 985}) {
        Console.Write("y="+y+": ");
        for (int x=200; x<1080; x+=40) {
          int i=y*stride+x*4;
          Console.Write("{0}:{1},{2},{3} ", x, pix[i+2], pix[i+1], pix[i]);
        }
        Console.WriteLine();
      }
    }
  }
}
