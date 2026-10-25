using System;
using System.IO;
using System.Collections;
using System.Collections.Generic;
using System.Diagnostics;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows.Forms;

namespace CodexUI {
 public static class CharacterLauncher {
  static readonly JavaScriptSerializer Json=new JavaScriptSerializer();
  static string Quote(string s){return "\""+s.Replace("\"","\\\"")+"\"";}
  static HashSet<string> ReadIds(string root){
   var data=Json.Deserialize<Dictionary<string,object>>(File.ReadAllText(Path.Combine(root,"catalog.json"),Encoding.UTF8));
   var result=new HashSet<string>();
   foreach(var item in (IEnumerable)data["characters"]){
    var c=(Dictionary<string,object>)item;string id=Convert.ToString(c["id"]);
    if(!System.Text.RegularExpressions.Regex.IsMatch(id,"^[a-z][a-z0-9-]{1,31}$")||!result.Add(id)||Convert.ToString(c["path"])!="characters/"+id)throw new Exception("角色目录无效。");
   }
   return result;
  }
  static void VerifyRuntime(string root){
   var manifest=Json.Deserialize<Dictionary<string,string>>(File.ReadAllText(Path.Combine(root,"integrity.json")));
   using(var hash=SHA256.Create())using(var stream=File.OpenRead(Path.Combine(root,"runtime","node.exe"))){
    string actual=BitConverter.ToString(hash.ComputeHash(stream)).Replace("-","").ToLowerInvariant();
    if(!manifest.ContainsKey("runtime/node.exe")||actual!=manifest["runtime/node.exe"])throw new Exception("运行文件校验失败，请重新解压集成版。");
   }
  }
  static Dictionary<string,object> Run(string root,string operation,string id){
   VerifyRuntime(root);
   var args=Quote(Path.Combine(root,"integration","switch.mjs"))+" "+operation+(id==null?"":" "+id);
   var start=new ProcessStartInfo(Path.Combine(root,"runtime","node.exe"),args){WorkingDirectory=root,UseShellExecute=false,CreateNoWindow=true,WindowStyle=ProcessWindowStyle.Hidden,RedirectStandardOutput=true,RedirectStandardError=true,StandardOutputEncoding=Encoding.UTF8,StandardErrorEncoding=Encoding.UTF8};
   using(var process=Process.Start(start)){
    var errorTask=Task.Factory.StartNew(()=>process.StandardError.ReadToEnd());
    string output=process.StandardOutput.ReadToEnd();process.WaitForExit();string error=errorTask.Result;
    var lines=output.Trim().Split(new[]{'\r','\n'},StringSplitOptions.RemoveEmptyEntries);
    if(lines.Length==0)throw new Exception(String.IsNullOrWhiteSpace(error)?"启动器没有返回结果。":error);
    return Json.Deserialize<Dictionary<string,object>>(lines[lines.Length-1]);
   }
  }
  static string Field(IDictionary<string,object> result,string name){object value;return result!=null&&result.TryGetValue(name,out value)?Convert.ToString(value):String.Empty;}
  internal static string ResultNotice(IDictionary<string,object> result){
   string message=Field(result,"message").Trim(),detail=Field(result,"detail").Trim();
   if(message.Length==0)message="操作未完成（"+(Field(result,"status").Length==0?"未知状态":Field(result,"status"))+"）。";
   return detail.Length==0||detail==message?message:message+Environment.NewLine+Environment.NewLine+detail;
  }
  internal static int ResultExitCode(IDictionary<string,object> result){
   switch(Field(result,"status")){
    case "ready":case "waiting":return 0;
    case "selected":return 3; // Saved the selection, but no client was launched.
    case "blocked":return 4;
    case "error":return 1;
    default:return 2;
   }
  }
  [STAThread]public static int Main(string[] args){
   try{
    string root=AppDomain.CurrentDomain.BaseDirectory;Application.EnableVisualStyles();
    string operation="--launch",id=null;
    if(args.Length==2&&args[0]=="--character"){
     if(!ReadIds(root).Contains(args[1]))throw new Exception("未知角色。");operation="--select";id=args[1];
    }else if(args.Length==1&&args[0]=="--restore")operation="--restore";
    else if(args.Length>0)throw new Exception("未知参数。");
    var result=Run(root,operation,id);string status=Field(result,"status");
    if((status!="ready"&&status!="waiting")||operation=="--restore")MessageBox.Show(ResultNotice(result),"Codex UI",MessageBoxButtons.OK,ResultExitCode(result)==0?MessageBoxIcon.Information:MessageBoxIcon.Warning);
    return ResultExitCode(result);
   }catch(Exception e){MessageBox.Show(e.Message,"Codex UI",MessageBoxButtons.OK,MessageBoxIcon.Information);return 1;}
  }
 }
}
