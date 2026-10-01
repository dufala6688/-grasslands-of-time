using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
class Scan2 {
  static void Main() {
    using (var bmp = new Bitmap(@"C:\Users\dufala.DESKTOP-28S4BRA\草原\assets\ui\panel.png")) {
      var bd = bmp.LockBits(new Rectangle(0,0,bmp.Width,bmp.Height), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
      int stride = bd.Stride;
      byte[] pix = new byte[stride * bmp.Height];
      Marshal.Copy(bd.Scan0, pix, 0, pix.Length);
      bmp.UnlockBits(bd);
      int[] ys = new int[]{270, 280, 630, 640, 980, 990};
      // find bar x-range on known rows
      int[] rows = new int[]{259,306, 612,659, 961,1008};
      foreach (int y in new int[]{282, 635, 984}) {
        int x0=-1,x1=-1;
        for (int x=200; x<1080; x++) {
          int i = y*stride + x*4;
          int b=pix[i], g=pix[i+1], r=pix[i+2];
          bool bar = r>200 && r<242 && g>180 && g<225 && b>160 && b<210 && (r-b)>22 && (r-g)>8;
          if (bar) { if (x0<0) x0=x; x1=x; }
        }
        int ink0=-1, ink1=-1;
        for (int x=850; x<1080; x++) {
          int i = y*stride + x*4;
          int b=pix[i], g=pix[i+1], r=pix[i+2];
          if (r<100 && g<90 && b<80) { if (ink0<0) ink0=x; ink1=x; }
        }
        Console.WriteLine("y={0} bar {1}-{2} ink {3}-{4}", y, x0, x1, ink0, ink1);
      }
      // vertical extent at x=500
      bool inn=false; int y0=0;
      for (int y=200; y<1150; y++) {
        int i = y*stride + 500*4;
        int b=pix[i], g=pix[i+1], r=pix[i+2];
        bool bar = r>200 && r<242 && g>180 && g<225 && b>160 && b<210 && (r-b)>22 && (r-g)>8;
        if (bar && !inn) { inn=true; y0=y; }
        else if (!bar && inn) { Console.WriteLine("vbar {0}-{1}", y0, y-1); inn=false; }
      }
    }
  }
}
