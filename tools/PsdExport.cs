using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Text;
using System.Collections.Generic;

class PsdExport {
  static uint U32(BinaryReader r) {
    byte[] b = r.ReadBytes(4);
    return (uint)((b[0] << 24) | (b[1] << 16) | (b[2] << 8) | b[3]);
  }
  static int I32(BinaryReader r) { return unchecked((int)U32(r)); }
  static ushort U16(BinaryReader r) {
    byte[] b = r.ReadBytes(2);
    return (ushort)((b[0] << 8) | b[1]);
  }

  class Ch { public int id; public uint len; }
  class Ly {
    public int top, left, bottom, right;
    public List<Ch> chans = new List<Ch>();
    public string name;
  }

  static byte[] ReadRle(BinaryReader r, int w, int h) {
    // row byte counts
    int[] counts = new int[h];
    for (int y = 0; y < h; y++) counts[y] = U16(r);
    byte[] raw = new byte[w * h];
    int o = 0;
    for (int y = 0; y < h; y++) {
      int need = counts[y];
      int end = o + w;
      int consumed = 0;
      while (o < end && consumed < need) {
        int n = (sbyte)r.ReadByte();
        consumed++;
        if (n >= 0) {
          int cnt = n + 1;
          byte[] lit = r.ReadBytes(cnt);
          consumed += cnt;
          for (int i = 0; i < cnt && o < end; i++) raw[o++] = lit[i];
        } else if (n != -128) {
          int cnt = 1 - n;
          byte v = r.ReadByte();
          consumed++;
          for (int i = 0; i < cnt && o < end; i++) raw[o++] = v;
        }
      }
      // if row short, pad
      while (o < end) raw[o++] = 0;
    }
    return raw;
  }

  static void Main(string[] args) {
    string src = args[0];
    string dir = args[1];
    Directory.CreateDirectory(dir);
    var layers = new List<Ly>();
    using (var fs = File.OpenRead(src))
    using (var r = new BinaryReader(fs)) {
      fs.Position = 26;
      uint cm = U32(r); fs.Position += cm;
      uint ir = U32(r); fs.Position += ir;
      uint lm = U32(r);
      long lmEnd = fs.Position + lm;
      uint li = U32(r);
      short count = unchecked((short)U16(r));
      if (count < 0) count = (short)-count;
      for (int i = 0; i < count; i++) {
        var L = new Ly();
        L.top = I32(r); L.left = I32(r); L.bottom = I32(r); L.right = I32(r);
        int nch = U16(r);
        for (int c = 0; c < nch; c++) {
          var ch = new Ch();
          ch.id = unchecked((short)U16(r));
          ch.len = U32(r);
          L.chans.Add(ch);
        }
        r.ReadBytes(8);
        r.ReadByte(); r.ReadByte(); r.ReadByte(); r.ReadByte();
        uint extra = U32(r);
        long extraStart = fs.Position;
        uint maskLen = U32(r);
        if (maskLen > 0) fs.Position += maskLen;
        uint blendLen = U32(r);
        if (blendLen > 0) fs.Position += blendLen;
        int nameLen = r.ReadByte();
        r.ReadBytes(nameLen);
        int nameField = 1 + nameLen;
        int pad = (4 - (nameField % 4)) % 4;
        fs.Position = extraStart + 4 + maskLen + 4 + blendLen + nameField + pad;
        string uni = "";
        while (fs.Position + 12 <= extraStart + extra) {
          r.ReadBytes(4);
          string akey = Encoding.ASCII.GetString(r.ReadBytes(4));
          uint alen = U32(r);
          long ab = fs.Position;
          if (akey == "luni" && alen >= 4) {
            uint ulen = U32(r);
            var sb = new StringBuilder();
            for (int k = 0; k < ulen; k++) {
              byte[] chb = r.ReadBytes(2);
              sb.Append((char)((chb[0] << 8) | chb[1]));
            }
            uni = sb.ToString();
          }
          long next = ab + alen;
          if ((alen & 1) == 1) next++;
          fs.Position = next;
        }
        fs.Position = extraStart + extra;
        L.name = uni;
        layers.Add(L);
      }
      // channel image data follows the layer records immediately
      Console.WriteLine("chanStart=" + fs.Position);
      var utf8 = new UTF8Encoding(false);
      var sbOut = new StringBuilder();
      for (int i = 0; i < layers.Count; i++) {
        var L = layers[i];
        int w = L.right - L.left;
        int h = L.bottom - L.top;
        sbOut.AppendLine(i + " " + L.left + "," + L.top + " " + w + "x" + h + " " + L.name);
        byte[] A = null, R = null, G = null, B = null;
        foreach (var ch in L.chans) {
          if (w <= 0 || h <= 0 || ch.len < 2) { fs.Position += ch.len; continue; }
          long start = fs.Position;
          ushort comp = U16(r);
          byte[] plane = null;
          if (comp == 0) plane = r.ReadBytes(w * h);
          else if (comp == 1) plane = ReadRle(r, w, h);
          else { fs.Position = start + ch.len; continue; }
          fs.Position = start + ch.len;
          if (ch.id == -1) A = plane;
          else if (ch.id == 0) R = plane;
          else if (ch.id == 1) G = plane;
          else if (ch.id == 2) B = plane;
        }
        if (w <= 0 || h <= 0 || R == null) continue;
        using (var bmp = new Bitmap(w, h, PixelFormat.Format32bppArgb)) {
          var bd = bmp.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);
          byte[] pix = new byte[w * h * 4];
          for (int p = 0; p < w * h; p++) {
            pix[p * 4 + 0] = B != null ? B[p] : (byte)0;
            pix[p * 4 + 1] = G != null ? G[p] : (byte)0;
            pix[p * 4 + 2] = R[p];
            pix[p * 4 + 3] = A != null ? A[p] : (byte)255;
          }
          System.Runtime.InteropServices.Marshal.Copy(pix, 0, bd.Scan0, pix.Length);
          bmp.UnlockBits(bd);
          string path = Path.Combine(dir, "layer" + i + ".png");
          bmp.Save(path, ImageFormat.Png);
        }
      }
      File.WriteAllText(Path.Combine(dir, "layers.txt"), sbOut.ToString(), utf8);
    }
  }
}
