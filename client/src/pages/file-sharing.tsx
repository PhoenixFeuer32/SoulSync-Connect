import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { useDropzone } from "react-dropzone";

interface SharedFile {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  isShared: boolean;
  createdAt: string;
}

export default function FileSharing() {
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const { toast } = useToast();

  const { data: files, isLoading } = useQuery({
    queryKey: ["/api/files"],
  });

  const uploadFileMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch("/api/files/upload", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) throw new Error("Failed to upload file");
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/files"] });
      setIsUploadDialogOpen(false);
      toast({
        title: "File Uploaded",
        description: `${data.originalName} has been uploaded successfully`
      });
    },
    onError: (error) => {
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const deleteFileMutation = useMutation({
    mutationFn: async (fileId: string) => {
      const response = await fetch(`/api/files/${fileId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete file");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/files"] });
      toast({
        title: "File Deleted",
        description: "File has been removed successfully"
      });
    }
  });

  const shareFileMutation = useMutation({
    mutationFn: async ({ fileId, companionId }: { fileId: string; companionId: string }) => {
      const response = await fetch("/api/files/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId, companionId }),
      });
      if (!response.ok) throw new Error("Failed to share file");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "File Shared",
        description: "File has been shared with your companion"
      });
    }
  });

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        uploadFileMutation.mutate(acceptedFiles[0]);
      }
    },
    maxFiles: 1,
    maxSize: 50 * 1024 * 1024, // 50MB
  });

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return 'fas fa-image';
    if (mimeType.startsWith('video/')) return 'fas fa-video';
    if (mimeType.startsWith('audio/')) return 'fas fa-music';
    if (mimeType.includes('pdf')) return 'fas fa-file-pdf';
    if (mimeType.includes('word')) return 'fas fa-file-word';
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'fas fa-file-excel';
    if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return 'fas fa-file-powerpoint';
    if (mimeType.includes('zip') || mimeType.includes('archive')) return 'fas fa-file-archive';
    return 'fas fa-file';
  };

  const getFileColor = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return 'text-chart-2';
    if (mimeType.startsWith('video/')) return 'text-chart-1';
    if (mimeType.startsWith('audio/')) return 'text-chart-4';
    if (mimeType.includes('pdf')) return 'text-destructive';
    return 'text-muted-foreground';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">File Sharing</h1>
          <p className="text-muted-foreground">Share files with your AI companions during conversations</p>
        </div>
        
        <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/80" data-testid="button-upload-file">
              <i className="fas fa-upload mr-2"></i>
              Upload File
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Upload File</DialogTitle>
            </DialogHeader>
            
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                isDragActive ? 'border-primary bg-primary/10' : 'border-muted-foreground hover:border-primary'
              }`}
              data-testid="dropzone-upload"
            >
              <input {...getInputProps()} />
              <i className="fas fa-cloud-upload-alt text-4xl text-muted-foreground mb-4"></i>
              <p className="text-lg font-medium mb-2">
                {isDragActive ? 'Drop the file here' : 'Drag & drop a file here'}
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                or click to select a file
              </p>
              <p className="text-xs text-muted-foreground">
                Maximum file size: 50MB
              </p>
            </div>

            {uploadFileMutation.isPending && (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                <p className="text-sm text-muted-foreground">Uploading...</p>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Upload Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <i className="fas fa-file text-primary text-xl"></i>
              <div>
                <p className="text-2xl font-bold">{files?.length || 0}</p>
                <p className="text-sm text-muted-foreground">Total Files</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <i className="fas fa-share text-chart-2 text-xl"></i>
              <div>
                <p className="text-2xl font-bold">
                  {files?.filter((f: SharedFile) => f.isShared).length || 0}
                </p>
                <p className="text-sm text-muted-foreground">Shared Files</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <i className="fas fa-hdd text-chart-4 text-xl"></i>
              <div>
                <p className="text-2xl font-bold">
                  {formatFileSize(
                    files?.reduce((total: number, file: SharedFile) => total + file.size, 0) || 0
                  )}
                </p>
                <p className="text-sm text-muted-foreground">Total Storage</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <i className="fas fa-clock text-accent text-xl"></i>
              <div>
                <p className="text-2xl font-bold">
                  {files?.filter((f: SharedFile) => {
                    const fileDate = new Date(f.createdAt);
                    const today = new Date();
                    return fileDate.toDateString() === today.toDateString();
                  }).length || 0}
                </p>
                <p className="text-sm text-muted-foreground">Today</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Files Grid */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Your Files</CardTitle>
            <div className="flex items-center space-x-2">
              <Input
                placeholder="Search files..."
                className="w-64"
                data-testid="input-search-files"
              />
              <Button variant="outline" size="sm" data-testid="button-filter-files">
                <i className="fas fa-filter mr-2"></i>
                Filter
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            </div>
          ) : files && files.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {files.map((file: SharedFile) => (
                <Card key={file.id} className="relative">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <i className={`${getFileIcon(file.mimeType)} ${getFileColor(file.mimeType)} text-2xl`}></i>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate" title={file.originalName}>
                            {file.originalName}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {formatFileSize(file.size)}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-1">
                        {file.isShared && (
                          <span className="w-2 h-2 bg-chart-2 rounded-full" title="Shared"></span>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteFileMutation.mutate(file.id)}
                          className="text-muted-foreground hover:text-destructive"
                          data-testid={`button-delete-file-${file.id}`}
                        >
                          <i className="fas fa-trash text-xs"></i>
                        </Button>
                      </div>
                    </div>
                    
                    <div className="text-xs text-muted-foreground mb-3">
                      Uploaded {new Date(file.createdAt).toLocaleDateString()}
                    </div>
                    
                    <div className="flex space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        data-testid={`button-download-${file.id}`}
                      >
                        <i className="fas fa-download mr-2"></i>
                        Download
                      </Button>
                      
                      <Button
                        size="sm"
                        onClick={() => shareFileMutation.mutate({ fileId: file.id, companionId: 'active' })}
                        disabled={shareFileMutation.isPending}
                        data-testid={`button-share-file-${file.id}`}
                      >
                        <i className="fas fa-share"></i>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <i className="fas fa-folder-open text-6xl text-muted-foreground mb-4"></i>
              <h3 className="text-xl font-semibold mb-2">No Files Yet</h3>
              <p className="text-muted-foreground mb-4">
                Upload your first file to start sharing with your companions
              </p>
              <Button
                onClick={() => setIsUploadDialogOpen(true)}
                className="bg-primary hover:bg-primary/80"
                data-testid="button-upload-first-file"
              >
                <i className="fas fa-upload mr-2"></i>
                Upload Your First File
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* File Type Guidelines */}
      <Card>
        <CardHeader>
          <CardTitle>Supported File Types</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-muted rounded-lg">
              <i className="fas fa-image text-chart-2 text-2xl mb-2"></i>
              <h4 className="font-semibold mb-1">Images</h4>
              <p className="text-sm text-muted-foreground">
                JPG, PNG, GIF, WebP
              </p>
            </div>
            
            <div className="text-center p-4 bg-muted rounded-lg">
              <i className="fas fa-file-pdf text-destructive text-2xl mb-2"></i>
              <h4 className="font-semibold mb-1">Documents</h4>
              <p className="text-sm text-muted-foreground">
                PDF, DOC, DOCX, TXT
              </p>
            </div>
            
            <div className="text-center p-4 bg-muted rounded-lg">
              <i className="fas fa-music text-chart-4 text-2xl mb-2"></i>
              <h4 className="font-semibold mb-1">Audio</h4>
              <p className="text-sm text-muted-foreground">
                MP3, WAV, M4A, OGG
              </p>
            </div>
            
            <div className="text-center p-4 bg-muted rounded-lg">
              <i className="fas fa-video text-chart-1 text-2xl mb-2"></i>
              <h4 className="font-semibold mb-1">Video</h4>
              <p className="text-sm text-muted-foreground">
                MP4, WebM, AVI, MOV
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
