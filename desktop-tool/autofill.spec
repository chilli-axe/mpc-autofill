# -*- mode: python ; coding: utf-8 -*-
from PyInstaller.utils.hooks import collect_dynamic_libs

block_cipher = None


a = Analysis(['autofill.py'],
             binaries=collect_dynamic_libs('ansicon') + collect_dynamic_libs('enlighten'),
             datas=[],
             hiddenimports=['colorama', 'jinxed.terminfo.vtwin10', 'wakepy._linux._jeepney_dbus'],
             hookspath=[],
             runtime_hooks=[],
             excludes=[],
             win_no_prefer_redirects=False,
             win_private_assemblies=False,
             cipher=block_cipher,
             noarchive=False)
pyz = PYZ(a.pure, a.zipped_data,
             cipher=block_cipher)
exe = EXE(pyz,
          a.scripts,
          a.binaries,
          a.zipfiles,
          a.datas,
          [],
          name='autofill',
          debug=False,
          bootloader_ignore_signals=False,
          strip=False,
          upx=True,
          upx_exclude=[],
          runtime_tmpdir=None,
          console=True ,
          icon='favicon.ico')
