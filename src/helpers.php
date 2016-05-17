<?php

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

function indexDir($path)
{
    $filesystem = new \Illuminate\Filesystem\Filesystem();

    $files = ['path' => [], 'hash' => []];

    foreach ($filesystem->allFiles($path) as $file) {
        /** @var Symfony\Component\Finder\SplFileInfo $file */

        $files['path'][$file->getRelativePathname()] = md5_file(file_build_path($path, $file->getRelativePathname()));
    }

    $files['hash'] = array_flip($files['path']);

    return $files;
}

function file_build_path(...$segments)
{
    return implode(DIRECTORY_SEPARATOR, $segments);
}
