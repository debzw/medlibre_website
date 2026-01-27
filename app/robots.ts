import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
    return {
        rules: [
            {
                userAgent: '*',
                allow: '/',
                disallow: ['/app', '/setup', '/statistics', '/profile', '/admin', '/dev-login'],
            },
        ],
        sitemap: 'https://medlibre.com.br/sitemap.xml',
    };
}
