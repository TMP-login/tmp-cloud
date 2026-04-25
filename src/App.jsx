import React, { useState, useEffect, useRef } from 'react'

const API_PREFIX = '/api'

export default function App() {
  const [files, setFiles] = useState([])
  const [currentPath, setCurrentPath] = useState('')
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [passwordPrompt, setPasswordPrompt] = useState(false)
  const [password, setPassword] = useState('')
  const [totalUsed, setTotalUsed] = useState(0)
  const [pendingFiles, setPendingFiles] = useState(null)
  const [notice, setNotice] = useState({ message: '', type: 'success' })
  const [contextMenu, setContextMenu] = useState({ open: false, x: 0, y: 0 })
  const [createDialog, setCreateDialog] = useState({ open: false, type: 'folder', name: '' })
  const fileInputRef = useRef(null)
  const folderInputRef = useRef(null)

  const LIMIT = 10 * 1024 * 1024 * 1024 // 10GB

  const showNotice = (message, type = 'success') => {
    setNotice({ message, type })
  }

  // 获取文件列表
  const fetchFiles = async () => {
    setLoading(true)
    try {
      const response = await fetch(`${API_PREFIX}/list?path=${encodeURIComponent(currentPath)}`)
      const data = await response.json()
      setFiles(data.files || [])
      setTotalUsed(data.totalUsed || 0)
    } catch (error) {
      console.error('获取文件列表失败:', error)
      showNotice('获取文件列表失败', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchFiles()
  }, [currentPath])

  useEffect(() => {
    if (!notice.message) return
    const timer = setTimeout(() => setNotice({ message: '', type: 'success' }), 2400)
    return () => clearTimeout(timer)
  }, [notice])

  useEffect(() => {
    const handleGlobalClose = () => {
      setContextMenu(prev => prev.open ? { ...prev, open: false } : prev)
    }

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setContextMenu(prev => prev.open ? { ...prev, open: false } : prev)
        setCreateDialog(prev => prev.open ? { ...prev, open: false } : prev)
        setPasswordPrompt(false)
      }
    }

    document.addEventListener('mousedown', handleGlobalClose)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleGlobalClose)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

  // 路径导航
  const navigateTo = (path) => {
    setCurrentPath(path)
    setUploadProgress(0)
  }

  const goBack = () => {
    const parts = currentPath.split('/').filter(p => p)
    if (parts.length > 0) {
      parts.pop()
      navigateTo(parts.join('/'))
    }
  }

  const goRoot = () => {
    navigateTo('')
  }

  const openContextMenu = (event) => {
    event.preventDefault()
    
    // 计算菜单位置，确保不会超出屏幕边界
    const menuWidth = 200 // 预估菜单宽度
    const menuHeight = 160 // 预估菜单高度
    const windowWidth = window.innerWidth
    const windowHeight = window.innerHeight
    
    let x = event.clientX
    let y = event.clientY
    
    // 检查右侧边界
    if (x + menuWidth > windowWidth) {
      x = windowWidth - menuWidth - 10
    }
    
    // 检查底部边界
    if (y + menuHeight > windowHeight) {
      y = windowHeight - menuHeight - 10
    }
    
    setContextMenu({
      open: true,
      x: x,
      y: y
    })
  }

  const openCreateDialog = (type) => {
    setContextMenu(prev => ({ ...prev, open: false }))
    setCreateDialog({ open: true, type, name: '' })
  }

  // 处理上传
  const handleUpload = async (fileList) => {
    if (fileList.length === 0) return

    let newSize = 0
    const allFilesToUpload = []

    const readAllEntries = async (directoryReader) => {
      const entries = []
      while (true) {
        const batch = await new Promise(resolve => directoryReader.readEntries(resolve))
        if (!batch.length) break
        entries.push(...batch)
      }
      return entries
    }

    // 递归收集目录中的所有文件，并保留相对路径
    const walkEntry = async (entry, basePath = '') => {
      if (!entry) return
      if (entry.isFile) {
        const file = await new Promise(resolve => entry.file(resolve))
        allFilesToUpload.push({
          file,
          path: basePath ? `${basePath}/${file.name}` : file.name
        })
        newSize += file.size
        return
      }

      if (entry.isDirectory) {
        const nextBase = basePath ? `${basePath}/${entry.name}` : entry.name
        const children = await readAllEntries(entry.createReader())
        for (const child of children) {
          await walkEntry(child, nextBase)
        }
      }
    }

    // 如果是 DataTransfer 列表
    if (fileList[0]?.webkitGetAsEntry) {
      const entries = Array.from(fileList).map(item => item.webkitGetAsEntry()).filter(Boolean)
      for (const entry of entries) {
        await walkEntry(entry)
      }
    } else {
      // 普通文件 / 文件夹选择，优先使用 webkitRelativePath 保留目录结构
      for (const file of fileList) {
        const relativePath = file.webkitRelativePath || file.name
        allFilesToUpload.push({
          file,
          path: relativePath
        })
        newSize += file.size
      }
    }

    // 检查空间
    if (totalUsed + newSize > LIMIT) {
      setPendingFiles(allFilesToUpload)
      setPasswordPrompt(true)
      return
    }

    await uploadFiles(allFilesToUpload)
  }

  // 上传文件到后端
  const uploadFiles = async (filesToUpload) => {
    setUploading(true)
    setUploadProgress(0)

    try {
      for (let i = 0; i < filesToUpload.length; i++) {
        const { file, path } = filesToUpload[i]
        const formData = new FormData()
        formData.append('file', file)
        formData.append('path', currentPath ? currentPath + '/' + path : path)

        // 添加密码（如果需要）
        if (passwordPrompt && password) {
          formData.append('password', password)
        }

        const response = await fetch(`${API_PREFIX}/upload`, {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) {
          throw new Error(`上传失败: ${response.statusText}`)
        }

        setUploadProgress(Math.round(((i + 1) / filesToUpload.length) * 100))
        }

      setPassword('')
      setPasswordPrompt(false)
      setPendingFiles(null)
      showNotice('上传成功', 'success')
      fetchFiles()
    } catch (error) {
      console.error('上传错误:', error)
      showNotice('上传失败: ' + error.message, 'error')
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }

  const sanitizeFolderName = (name) => name
    .trim()
    .replace(/[<>:"|?*]/g, '_')
    .replace(/[\\/]+/g, '_')

  const sanitizeFileName = (name) => name
    .trim()
    .replace(/[<>:"|?*]/g, '_')
    .replace(/[\\/]+/g, '_')

  const handleCreateItem = async () => {
    const dialogName = createDialog.type === 'folder'
      ? sanitizeFolderName(createDialog.name)
      : sanitizeFileName(createDialog.name)

    const finalName = createDialog.type === 'txt' && dialogName && !dialogName.toLowerCase().endsWith('.txt')
      ? `${dialogName}.txt`
      : dialogName

    if (!finalName) {
      showNotice(createDialog.type === 'folder' ? '文件夹名称不能为空' : '文档名称不能为空', 'error')
      return
    }

    if (files.some(file => file.name === finalName)) {
      showNotice('同名文件或文件夹已存在', 'error')
      return
    }

    if (createDialog.type === 'folder') {
      try {
        const response = await fetch(`${API_PREFIX}/create-folder`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            path: currentPath ? `${currentPath}/${finalName}` : finalName
          })
        })

        if (!response.ok) {
          const data = await response.json().catch(() => ({}))
          throw new Error(data.error || '创建文件夹失败')
        }

        setCreateDialog({ open: false, type: 'folder', name: '' })
        showNotice('文件夹已创建', 'success')
        fetchFiles()
      } catch (error) {
        showNotice('创建文件夹失败: ' + error.message, 'error')
      }
      return
    }

    try {
      const emptyFile = new File([''], finalName, { type: 'text/plain' })
      const formData = new FormData()
      formData.append('file', emptyFile)
      formData.append('path', currentPath ? `${currentPath}/${finalName}` : finalName)

      const response = await fetch(`${API_PREFIX}/upload`, {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || '创建文档失败')
      }

      setCreateDialog({ open: false, type: 'txt', name: '' })
      showNotice('文档已创建', 'success')
      fetchFiles()
    } catch (error) {
      showNotice('创建文档失败: ' + error.message, 'error')
    }
  }

  const handleCreateDialogKeyDown = (event) => {
    if (event.key === 'Enter') {
      handleCreateItem()
    }
  }

  // 处理密码验证上传
  const handlePasswordUpload = async () => {
    if (!password) {
      showNotice('请输入密码', 'error')
      return
    }

    try {
      const response = await fetch(`${API_PREFIX}/verify-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      })

      if (!response.ok) {
        showNotice('密码错误', 'error')
        return
      }

      await uploadFiles(pendingFiles)
    } catch (error) {
      showNotice('验证失败: ' + error.message, 'error')
    }
  }

  // 删除文件
  const handleDelete = async (fileName, isDirectory = false) => {
    try {
      const response = await fetch(`${API_PREFIX}/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: currentPath ? currentPath + '/' + fileName : fileName,
          isDirectory
        })
      })

      if (!response.ok) {
        throw new Error('删除失败')
      }

      showNotice('删除成功', 'success')
      fetchFiles()
    } catch (error) {
      showNotice('删除失败: ' + error.message, 'error')
    }
  }

  // 下载文件
  const handleDownload = (fileName, isDirectory = false) => {
    const path = currentPath ? currentPath + '/' + fileName : fileName
    window.location.href = `${API_PREFIX}/download?path=${encodeURIComponent(path)}${isDirectory ? '&type=folder' : ''}`
  }

  // 进入文件夹
  const enterFolder = (folderName) => {
    const newPath = currentPath ? currentPath + '/' + folderName : folderName
    navigateTo(newPath)
  }

  // 拖拽处理
  const handleDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (!uploading) {
      handleUpload(e.dataTransfer.items || e.dataTransfer.files)
    }
  }

  const handleFileSelect = (e) => {
    if (e.target.files.length > 0) {
      handleUpload(e.target.files)
      e.target.value = ''
    }
  }

  const handleFolderSelect = (e) => {
    if (e.target.files.length > 0) {
      handleUpload(e.target.files)
      e.target.value = ''
    }
  }

  const triggerFileSelect = () => {
    fileInputRef.current?.click()
  }

  const triggerFolderSelect = () => {
    folderInputRef.current?.click()
  }

  // 分离文件夹和文件
  const folders = files.filter(f => f.isDirectory).sort((a, b) => a.name.localeCompare(b.name))
  const regularFiles = files.filter(f => !f.isDirectory).sort((a, b) => a.name.localeCompare(b.name))

  // 格式化文件大小
  const formatSize = (bytes) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  // 格式化日期
  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleString('zh-CN')
  }

  return (
    <div className="app" onDragOver={handleDragOver} onDrop={handleDrop} onContextMenu={openContextMenu}>
      {notice.message && (
        <div className={`toast ${notice.type === 'error' ? 'toast-error' : 'toast-success'}`} role="status" aria-live="polite">
          {notice.message}
        </div>
      )}

      <header className="header">
        <h1>📁 临时网盘</h1>
        <p className="space-info">
          已用: {formatSize(totalUsed)} / {formatSize(LIMIT)}
          <span className={`space-bar ${totalUsed > LIMIT * 0.8 ? 'warning' : ''}`}>
            <span style={{ width: Math.min(100, (totalUsed / LIMIT) * 100) + '%' }}></span>
          </span>
        </p>
      </header>

      <nav className="breadcrumb">
        <button onClick={goRoot}>首页</button>
        {currentPath.split('/').filter(p => p).map((part, idx, arr) => (
          <React.Fragment key={idx}>
            <span> / </span>
            <button onClick={() => navigateTo(arr.slice(0, idx + 1).join('/'))}>{part}</button>
          </React.Fragment>
        ))}
      </nav>

      {loading ? (
        <div className="loading">加载中...</div>
      ) : (
        <div className="file-list">
          {folders.length === 0 && regularFiles.length === 0 ? (
            <p className="empty">右键空白处上传或创建内容</p>
          ) : (
            <>
              {folders.map(folder => (
                <div key={folder.name} className="file-item folder-item">
                  <div className="file-info" onClick={() => enterFolder(folder.name)}>
                    <span className="file-name">📁 {folder.name}</span>
                  </div>
                  <div className="file-actions">
                    <button onClick={(e) => { e.stopPropagation(); handleDownload(folder.name, true) }} className="btn-download">⬇️ 打包下载</button>
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(folder.name, true) }} className="btn-delete">🗑️ 删除</button>
                  </div>
                </div>
              ))}
              {regularFiles.map(file => (
                <div key={file.name} className="file-item">
                  <div className="file-info">
                    <span className="file-name">📄 {file.name}</span>
                    <span className="file-size">{formatSize(file.size)}</span>
                    <span className="file-date">{formatDate(file.uploaded)}</span>
                  </div>
                  <div className="file-actions">
                    <button onClick={() => handleDownload(file.name)} className="btn-download">⬇️ 下载</button>
                    <button onClick={() => handleDelete(file.name)} className="btn-delete">🗑️ 删除</button>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {contextMenu.open && (
        <div
          className="context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onMouseDown={e => e.stopPropagation()}
        >
          <button onClick={triggerFileSelect}>📄 上传文件</button>
          <button onClick={triggerFolderSelect}>📁 上传文件夹</button>
          <button onClick={() => openCreateDialog('folder')}>📁 创建文件夹</button>
          <button onClick={() => openCreateDialog('txt')}>📝 创建txt文档</button>
        </div>
      )}

      {createDialog.open && (
        <div className="modal-overlay" onClick={() => setCreateDialog(prev => ({ ...prev, open: false }))}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{createDialog.type === 'folder' ? '新建文件夹' : '新建txt文档'}</h2>
            <p>{createDialog.type === 'folder' ? '输入文件夹名称后创建目录标记。' : '输入文件名后创建空文本文件。'}</p>
            <input
              type="text"
              value={createDialog.name}
              onChange={e => setCreateDialog(prev => ({ ...prev, name: e.target.value }))}
              placeholder={createDialog.type === 'folder' ? '请输入文件夹名称' : '请输入文档名称'}
              onKeyDown={handleCreateDialogKeyDown}
            />
            <div className="modal-buttons">
              <button onClick={handleCreateItem} className="btn-confirm">创建</button>
              <button onClick={() => setCreateDialog(prev => ({ ...prev, open: false }))} className="btn-cancel">取消</button>
            </div>
          </div>
        </div>
      )}

      {passwordPrompt && (
        <div className="modal-overlay" onClick={() => { setPasswordPrompt(false); setPassword('') }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>空间不足需要密码</h2>
            <p>文件总大小将超过 10GB 免费额度，需要输入密码才能上传。</p>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="请输入密码"
              onKeyPress={e => e.key === 'Enter' && handlePasswordUpload()}
            />
            <div className="modal-buttons">
              <button onClick={handlePasswordUpload} className="btn-confirm">上传</button>
              <button onClick={() => { setPasswordPrompt(false); setPassword('') }} className="btn-cancel">取消</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
