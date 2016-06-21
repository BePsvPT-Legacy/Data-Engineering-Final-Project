<?php

define('BUFFER_SIZE', 1024 * 1024);
define('FREAD_SIZE', 1024 * 128);

function packData($type, $data = null)
{
    return serialize([
        'type' => $type,
        'data' => $data,
    ]).PHP_EOL;
}

function unpackData($data)
{
    return unserialize(trim($data));
}

function indexDir($dir)
{
    $filesystem = new \Illuminate\Filesystem\Filesystem();

    $files = [];

    foreach ($filesystem->allFiles($dir) as $file) {
        /** @var Symfony\Component\Finder\SplFileInfo $file */

        $hash = sha1(implode('|', [
            $file->getRelativePathname(), $file->getType(), $file->getSize(), $file->getMTime(),
        ]));

        $path = file_build_path($dir, $file->getRelativePathname());

        $fp = fopen($path, "rb");
        $first100 = fread($fp, 100);
        fseek($fp, -100, SEEK_END);
        $last100 = fread($fp, 100);
        fclose($fp);

        $files[$hash] = [
            'path' => $file->getRelativePathname(),
            'dir' => $file->getRelativePath(),
            'name' => $file->getFilename(),
            'type' => $file->getType(),
            'size' => $file->getSize(),
            'mtime' => $file->getMTime(),
            'mime' => mime_content_type($path),
            'quickHash' => md5("{$first100}|{$last100}"),
        ];
    }

    return $files;
}

function file_build_path(...$segments)
{
    return implode(DIRECTORY_SEPARATOR, $segments);
}

function create_dir ($path)
{
    if (strlen($path) > 0 && ! is_dir($path)) {
        mkdir($path, 0755, true);
    }
}
