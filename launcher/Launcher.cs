using System;
using System.IO;
using System.Diagnostics;
using System.Collections.Generic;
using System.Web.Script.Serialization;
using System.Windows.Forms;
namespace SandroneCodex {
public static class Launcher {
 static ProcessStartInfo ControllerStart(string root,string token){
  string ps=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System),"WindowsPowerShell","v1.0");
  var start=new ProcessStartInfo(Path.Combine(ps,"powershell.exe"),"-NoProfile -NonInteractive -ExecutionPolicy RemoteSigned -File \""+Path.Combine(root,"engine","control.ps1")+"\" -Action launch -Token "+token+" -ActivateWindow"){UseShellExecute=false,CreateNoWindow=true,WindowStyle=ProcessWindowStyle.Hidden,WorkingDirectory=root};
  start.EnvironmentVariables["PSModulePath"]=Path.Combine(ps,"Modules")+";"+Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),"WindowsPowerShell","Modules")+";"+Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments),"WindowsPowerShell","Modules");
  return start;
 }
 static void Notice(string message){MessageBox.Show(message,"哥伦比娅 Codex",MessageBoxButtons.OK,MessageBoxIcon.Information);}
 [STAThread]public static void Main(string[] args){try{
  string root=AppDomain.CurrentDomain.BaseDirectory;
  if(Array.IndexOf(args,"--preview")>=0){Process.Start(new ProcessStartInfo(Path.Combine(root,"dist","Sandrone-preview.html")){UseShellExecute=true});return;}
  if(Array.IndexOf(args,"--restore")>=0){Process.Start(new ProcessStartInfo(Path.Combine(root,"一键恢复官方原版.cmd")){UseShellExecute=true,WorkingDirectory=root});return;}
  if(args.Length!=0)throw new ArgumentException("未知参数。请使用桌面的哥伦比娅 Codex 入口。");
  using(var mutex=new System.Threading.Mutex(false,"Local\\SandroneCodex.Launcher")){
   bool acquired=false;
   try{
    try{acquired=mutex.WaitOne(0);}catch(System.Threading.AbandonedMutexException){acquired=true;}
    if(!acquired)return;
    string token=Guid.NewGuid().ToString("N");
    using(var process=Process.Start(ControllerStart(root,token))){
     if(!process.WaitForExit(45000)){Notice("客户端仍在启动，请查看官方窗口。无需重复双击；不会强制退出客户端。");return;}
     string file=Path.Combine(root,"state","result-"+token+".json");
     if(!File.Exists(file)){Notice("启动器未收到结果，请查看 本程序目录的 state 文件夹，或从官方入口打开。");return;}
     var result=new JavaScriptSerializer().Deserialize<Dictionary<string,object>>(File.ReadAllText(file));
     string status=Convert.ToString(result["status"]);
     // Waiting for login/renderer is a normal state, never an error dialog.
     if(status!="ready"&&status!="waiting")Notice(Convert.ToString(result["message"])+"\n\n"+Convert.ToString(result["detail"]));
    }
   }finally{if(acquired)mutex.ReleaseMutex();}
  }
 }catch(Exception error){Notice(error.Message);}}
}
}