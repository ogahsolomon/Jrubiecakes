-- ============================================================
-- Fix product photos that 404.
--
-- The storefront renders /products/*.png paths. Several of those
-- filenames never matched the files actually committed under
-- public/products, so the image optimiser returned 404 and the
-- page showed a broken image.
--
-- This migration removes image rows whose local file does not
-- exist. The UI already renders a branded placeholder when a
-- product has no image, so the affected products display cleanly
-- until real photos are uploaded from the admin dashboard.
--
-- Safe to run more than once.
-- ============================================================

delete from public.product_images
where url like '/products/%'
  and url not in (
    -- only these local files are known to exist in public/products
    '/products/birthday-cake.png',
    '/products/childrens-cake.png',
    '/products/childrens-cake-2.png',
    '/products/number-cake.png',
    '/products/cupcakes.png',
    '/products/cake-loaf.png',
    '/products/uniced-cake.png',
    '/products/donuts.png',
    '/products/meat-pies.png',
    '/products/chin-chin.png',
    '/products/small-chops.png'
  );

-- Give every product with no remaining photo an accurate alt-free state:
-- the card falls back to its placeholder, so nothing else is required here.

-- Report what still has no photo (for the owner's awareness).
select p.slug, p.name
from public.products p
left join public.product_images i on i.product_id = p.id
where i.id is null
order by p.slug;