using System;
using System.Diagnostics;
using System.IO;
using System.Windows.Forms;
using System.Drawing;
using System.Runtime.InteropServices;
using NativeWindow=SandroneCodex.NativeWindow;
class Fixture : Form {
 protected override CreateParams CreateParams {get {var p=base.CreateParams;p.ExStyle|=0x08000000;return p;}}
 [DllImport("user32.dll")]static extern bool IsWindowVisible(IntPtr window);
 [DllImport("user32.dll")]static extern bool IsIconic(IntPtr window);
 [STAThread]static void Main(string[] args){
  // Only windows created by this test are ever activated. Transparent,
  // no-activate windows keep the user's actual Codex/session untouched.
  var form=new Fixture{Text="Sandrone main restore fixture",Width=1920,Height=1032,Opacity=0,ShowInTaskbar=false,StartPosition=FormStartPosition.Manual,Location=new Point(-18000,-18000),WindowState=FormWindowState.Minimized};
  var detached=new Fixture{Text="Sandrone detached fixture",Width=960,Height=720,Opacity=0,ShowInTaskbar=false,StartPosition=FormStartPosition.Manual,Location=new Point(-16000,-16000)};
  var timer=new Timer{Interval=300};bool pass=true,before=false;int phase=0;uint pid=(uint)Process.GetCurrentProcess().Id;string checks="";
  Action<bool,string> check=(ok,label)=>{pass&=ok;checks+=(ok?"PASS: ":"FAIL: ")+label+Environment.NewLine;};
  timer.Tick+=(s,e)=>{
   if(phase==0){before=NativeWindow.IsMinimized(pid);check(NativeWindow.Activate(pid,false),"own minimized main can be selected");}
   else if(phase==1){check(before&&!IsIconic(form.Handle),"own invisible minimized main restored");form.WindowState=FormWindowState.Normal;form.Size=new Size(1920,1032);form.Hide();detached.Show();}
   else if(phase==2){check(!IsWindowVisible(form.Handle)&&IsWindowVisible(detached.Handle),"fixture has hidden 1920x1032 main and visible 960x720 detached");check(NativeWindow.Activate(pid,false),"main selection succeeds with visible detached sibling");}
   else if(phase==3){check(IsWindowVisible(form.Handle),"hidden larger main restored instead of focusing smaller detached");check(IsWindowVisible(detached.Handle),"detached sibling remains intact");form.WindowState=FormWindowState.Minimized;}
   else if(phase==4){check(NativeWindow.IsMinimized(pid),"restored-area comparison still selects minimized main");check(NativeWindow.Activate(pid,false),"minimized main activation succeeds with detached sibling");}
   else if(phase==5){check(!IsIconic(form.Handle),"minimized main restored while detached remains visible");check(!NativeWindow.Activate(UInt32.MaxValue,false),"foreign PID with no windows is rejected");File.WriteAllText(args[0],checks);timer.Stop();detached.Close();form.Close();Environment.ExitCode=pass?0:1;}
   phase++;
  };
  form.Shown+=(s,e)=>timer.Start();Application.Run(form);
 }
}
