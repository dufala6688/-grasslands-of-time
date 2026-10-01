using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
class Face {
  static int Pink(byte[] pix, int stride, int x, int y) {
    int i=y*stride+x*4;
    int b=pix[i], g=pix[i+1], r=pix[i+2], a=pix[i+3];
    if (a<40) return 0;
    // pink nose: r high, g mid, b lower
    if (r>180 && g>80 && g<190 && b>80 && b<190 && r>g+20) return 1;
    return 0;
  }
  static void Scan(string path) {
    using (var bmp = new Bitmap(path)) {
      var bd = bmp.LockBits(new Rectangle(0,0,bmp.Width,bmp.Height), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
      int stride=bd.Stride; byte[] pix=new byte[stride*bmp.Height];
      Marshal.Copy(bd.Scan0, pix, 0, pix.Length); bmp.UnlockBits(bd);
      int left=0, right=0, mid=bmp.Width/2;
      for (int y=0;y<bmp.Height;y++) for (int x=0;x<bmp.Width;x++) {
        if (Pink(pix,stride,x,y)==0) continue;
        if (x<mid) left++; else right++;
      }
      Console.WriteLine("{0} {1}x{2} pinkLeft={3} pinkRight={4}", System.IO.Path.GetFileName(path), bmp.Width, bmp.Height, left, right);
    }
  }
  static void Main() {
    string d=@"C:\Users\dufala.DESKTOP-28S4BRA\草原\assets\sprites\";
    Scan(d+"cow_idle.png"); Scan(d+"cow_walk1.png");
    Scan(d+"sheep_idle.png"); Scan(d+"sheep_walk1.png");
    Scan(d+"dog_idle.png"); Scan(d+"dog_walk1.png");
  }
}
