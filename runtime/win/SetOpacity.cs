using System;
using System.Diagnostics;
using System.Runtime.InteropServices;

namespace Diffuse
{
    /// <summary>
    /// Loaded once into a long-lived PowerShell session.
    /// </summary>
    public static class SetOpacity
    {
        private const int GwlExStyle = -20;
        private const int WsExLayered = 0x00080000;
        private const uint LwaAlpha = 0x00000002;

        public static string Apply(int pid, byte alpha)
        {
            Process main;
            try
            {
                main = Process.GetProcessById(pid);
            }
            catch (ArgumentException)
            {
                return "no-process";
            }

            int painted = 0;
            foreach (Process proc in Process.GetProcessesByName(main.ProcessName))
            {
                IntPtr mainWindow = proc.MainWindowHandle;
                if (mainWindow == IntPtr.Zero)
                {
                    continue;
                }

                int unused;
                uint tid = Native.GetWindowThreadProcessId(mainWindow, out unused);
                Native.EnumThreadWindows(tid, (hWnd, _) =>
                {
                    if (!Native.IsWindowVisible(hWnd))
                    {
                        return true;
                    }

                    IntPtr exStyle = Native.GetWindowLongCompat(hWnd, GwlExStyle);
                    Native.SetWindowLongCompat(
                        hWnd,
                        GwlExStyle,
                        new IntPtr(exStyle.ToInt64() | WsExLayered)
                    );
                    if (Native.SetLayeredWindowAttributes(hWnd, 0, alpha, LwaAlpha))
                    {
                        painted++;
                    }
                    return true;
                }, IntPtr.Zero);
            }

            return painted > 0 ? "ok" : "no-window";
        }
    }

    internal static class Native
    {
        public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

        [DllImport("user32.dll")]
        public static extern bool EnumThreadWindows(
            uint dwThreadId,
            EnumWindowsProc lpEnumFunc,
            IntPtr lParam
        );

        [DllImport("user32.dll")]
        public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out int lpdwProcessId);

        [DllImport("user32.dll")]
        public static extern bool IsWindowVisible(IntPtr hWnd);

        [DllImport("user32.dll", EntryPoint = "GetWindowLongPtrW")]
        private static extern IntPtr GetWindowLongPtr64(IntPtr hWnd, int nIndex);

        [DllImport("user32.dll", EntryPoint = "GetWindowLongW")]
        private static extern int GetWindowLong32(IntPtr hWnd, int nIndex);

        [DllImport("user32.dll", EntryPoint = "SetWindowLongPtrW")]
        private static extern IntPtr SetWindowLongPtr64(IntPtr hWnd, int nIndex, IntPtr dwNewLong);

        [DllImport("user32.dll", EntryPoint = "SetWindowLongW")]
        private static extern int SetWindowLong32(IntPtr hWnd, int nIndex, int dwNewLong);

        [DllImport("user32.dll")]
        public static extern bool SetLayeredWindowAttributes(
            IntPtr hWnd,
            uint crKey,
            byte bAlpha,
            uint dwFlags
        );

        public static IntPtr GetWindowLongCompat(IntPtr hWnd, int nIndex)
        {
            return IntPtr.Size == 8
                ? GetWindowLongPtr64(hWnd, nIndex)
                : new IntPtr(GetWindowLong32(hWnd, nIndex));
        }

        public static void SetWindowLongCompat(IntPtr hWnd, int nIndex, IntPtr value)
        {
            if (IntPtr.Size == 8)
            {
                SetWindowLongPtr64(hWnd, nIndex, value);
            }
            else
            {
                SetWindowLong32(hWnd, nIndex, value.ToInt32());
            }
        }
    }
}
