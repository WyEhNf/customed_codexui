param([Parameter(Mandatory=$true)][string]$Root,[Parameter(Mandatory=$true)][string]$Output)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Globalization;
using System.Text;
public static class OpeningFontOutline {
 static string N(float n) { return Math.Round(n,1).ToString("0.#",CultureInfo.InvariantCulture); }
 static void Pair(StringBuilder s,PointF p) { s.Append(N(p.X));s.Append(',');s.Append(N(p.Y)); }
 public static object[] Make(string text,string family,bool bold) {
  using(var font = new FontFamily(family))
  using(var p = new GraphicsPath(FillMode.Alternate)) {
   var style=bold&&font.IsStyleAvailable(FontStyle.Bold)?FontStyle.Bold:FontStyle.Regular;
   p.AddString(text,font,(int)style,128,PointF.Empty,StringFormat.GenericTypographic);
   var bounds=p.GetBounds();
   using(var m=new Matrix()){m.Translate(3-bounds.X,3-bounds.Y);p.Transform(m);}
   var pts=p.PathPoints;var types=p.PathTypes;var s=new StringBuilder();
   for(int i=0;i<pts.Length;i++) {
    int t=types[i]&7;
    if(t==0){s.Append('M');Pair(s,pts[i]);}
    else if(t==1){s.Append('L');Pair(s,pts[i]);}
    else if(t==3){if(i+2>=pts.Length)throw new Exception("Invalid font curve");s.Append('C');Pair(s,pts[i]);s.Append(' ');Pair(s,pts[i+1]);s.Append(' ');Pair(s,pts[i+2]);i+=2;}
    else throw new Exception("Unexpected font segment");
    if((types[i]&128)!=0)s.Append('Z');
   }
   return new object[]{(int)Math.Ceiling(bounds.Width+6),(int)Math.Ceiling(bounds.Height+6),s.ToString()};
  }
 }
}
'@
$characters=(Get-Content -LiteralPath (Join-Path $Root 'integration/characters-build.json') -Raw -Encoding UTF8 | ConvertFrom-Json).characters
$records=@()
foreach($character in $characters){
 $meta=Get-Content -LiteralPath (Join-Path $Root ($character.path+'/presentation.json')) -Raw -Encoding UTF8 | ConvertFrom-Json
 $entries=[ordered]@{brand=($meta.themeName.ToUpper()+' · '+$meta.brandName.ToUpper());label=$meta.subtitle;sub=$meta.themeName;cn='CodeX';hint='双击任意处 · 或连续按两次空格跳过';connecting=$meta.loadingStates[0];applying=$meta.loadingStates[1];waiting=$meta.loadingStates[2];ready=$meta.loadingStates[3];error='主题接入暂未完成'}
 $marks=[ordered]@{}
 foreach($key in $entries.Keys){
  $font=if($key -eq 'cn'){'Segoe Script'}else{'华文行楷'}
  $shape=[OpeningFontOutline]::Make([string]$entries[$key],$font,($key -eq 'cn'))
  $marks[$key]=[ordered]@{text=[string]$entries[$key];font=$font;width=$shape[0];height=$shape[1];path=$shape[2]}
 }
 $records+=@{id=$character.id;entries=$marks}
}
[IO.Directory]::CreateDirectory((Split-Path -Parent $Output)) | Out-Null
[IO.File]::WriteAllText($Output,($records | ConvertTo-Json -Depth 10 -Compress),[Text.UTF8Encoding]::new($false))
Write-Output ('Exported local font outlines: '+$records.Count)
