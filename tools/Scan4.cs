using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
class Scan4 {
  static bool Bar(byte r, byte g, byte b) {
    return r>=210 && r<=236 && g>=190 && g<=216 && b>=170 && b<=205 && (r-g)>=8 && (r-g)<=28 && (g-b)>=6;
  }
  static void Main() {
    using (var bmp = new Bitmap(@"C:\Users\dufala.DESKTOP-28S4BRA\草原\assets\ui\panel.png")) {
      var bd = bmp.LockBits(new Rectangle(0,0,bmp.Width,bmp.Height), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
      int stride = bd.Stride;
      byte[] pix = new byte[stride * bmp.Height];
      Marshal.Copy(bd.Scan0, pix, 0, pix.Length);
      bmp.UnlockBits(bd);
      int[][] bands = new int[][]{ new[]{258,310}, new[]{610,665}, new[]{958,1012} };
      string[] names = {"cow","sheep","dog"};
      for (int n=0;n<3;n++) {
        int x0=9999,x1=-1,y0=9999,y1=-1;
        int ink0=9999, ink1=-1;
        for (int y=bands[n][0]; y<=bands[n][1]; y++) {
          for (int x=200; x<1080; x++) {
            int i=y*stride+x*4;
            if (Bar(pix[i+2], pix[i+1], pix[i])) {
              if (x<x0) x0=x; if (x>x1) x1=x; if (y<y0) y0=y; if (y>y1) y1=y;
            }
            if (x>880 && pix[i+2]<80 && pix[i+1]<70 && pix[i]<60) {
              if (x<ink0) ink0=x; if (x>ink1) ink1=x;
            }
          }
        }
        Console.WriteLine("{0} bar {1},{2} {3}x{4} ink {5}-{6}", names[n], x0, y0, x1-x0+1, y1-y0+1, ink0, ink1);
        Console.WriteLine("  pct left={0:F2} top={1:F2} w={2:F2} h={3:F2} inkRight={4:F2}",
          100.0*x0/1088, 100.0*y0/1259, 100.0*(x1-x0+1)/1088, 100.0*(y1-y0+1)/1259, 100.0*ink1/1088);
      }
    }
  }
}
