Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = scriptDir

homeDir = WshShell.ExpandEnvironmentStrings("%USERPROFILE%")
logDir = homeDir & "\AmbikaTrading\Logs"
If Not fso.FolderExists(homeDir & "\AmbikaTrading") Then
    On Error Resume Next
    fso.CreateFolder(homeDir & "\AmbikaTrading")
    On Error GoTo 0
End If
If Not fso.FolderExists(logDir) Then
    On Error Resume Next
    fso.CreateFolder(logDir)
    On Error GoTo 0
End If

logFile = logDir & "\launch.log"
cmd = "cmd /c start_app.bat > """ & logFile & """ 2>&1"
WshShell.Run cmd, 0, False
