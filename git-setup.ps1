& "C:\Program Files\Git\cmd\git.exe" init
& "C:\Program Files\Git\cmd\git.exe" remote add origin https://github.com/sukhdevyadav3/Rentpe-Antigravity-project.git
& "C:\Program Files\Git\cmd\git.exe" fetch origin
& "C:\Program Files\Git\cmd\git.exe" branch -M main
try {
    & "C:\Program Files\Git\cmd\git.exe" reset --mixed origin/main
} catch {
    Write-Host "Reset failed, trying master"
    & "C:\Program Files\Git\cmd\git.exe" reset --mixed origin/master
}
& "C:\Program Files\Git\cmd\git.exe" status
