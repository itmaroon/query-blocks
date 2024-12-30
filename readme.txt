=== Post Blocks ===
Contributors:      Web Creator ITmaroon
Tags:              block, post, taxsonomy, field
Requires at least: 6.3
Tested up to:      6.7.1
Stable tag:        0.1.0
License:           GPL-2.0-or-later
License URI:       https://www.gnu.org/licenses/gpl-2.0.html
Requires PHP: 8.2.10

This is a collection of blocks that display WordPress posts. It includes blocks for selectively displaying posts, setting selection, pagination, and displaying settings.

== Related Links ==

* [post-blocks:Github](https://github.com/itmaroon/post-blocks)
* [block-class-package:GitHub](https://github.com/itmaroon/block-class-package)  
* [block-class-package:Packagist](https://packagist.org/packages/itmar/block-class-package) 
* [itmar-block-packages:npm](https://www.npmjs.com/package/itmar-block-packages)  
* [itmar-block-packages:GitHub](https://github.com/itmaroon/itmar-block-packages)

== Description ==

When you install this plugin, the following four blocks are registered and can be used not only in the block editor but also in the site editor (tested with WordPress 6.7).

Below is a brief description of each block.

1. Post Pickup
Provides a function to pick up WordPress post data. Internally, it generates a subquery to extract data from the database. The extracted data is selected by selecting the post type and term, and the required fields are rendered by selecting the field. Custom fields can also be selected.

2. Post Filter
This block provides a UI for users to filter Post Pickups specified by ID. There are three types of filtering:
- Provides a filtering function by string search. The search targets are title, excerpt, and body text, but custom fields can also be targeted by selecting an option.
- Provides a filtering function for data posted within a set period. The period can be set to three types: year, month, and day.
- Provides a filtering function by terms set in posts. The terms to be filtered are selected by selecting the taxonomy associated with the post type.

3. Post Pagination
This block provides pagination display of Post Pickup specified by ID.
Two types are available: one that displays the page number and one that moves to the previous or next page. The type that displays the page number has Design Button as an inner block,
and the type that moves to the previous or next page has Design Title as an inner block.
Various customizations are possible by utilizing the design functions of these custom blocks.

4. Post Crumbs
This block displays the filtering information of Post Pickup specified by ID in the form of a breadcrumb list.
The filtering information is based on filtering by Post Filter and is displayed as the text of Design Title.
Therefore, various customizations are possible by using the design function of Design Title.
In addition, when Post Pickup is displayed as a single post, the title of the post is also displayed in addition to the filtering information.

== Installation ==

1. From the WP admin panel, click “Plugins” -> “Add new”.
2. In the browser input box, type “Post Blocks”.
3. Select the “Post Blocks” plugin and click “Install”.
4. Activate the plugin.

OR…

1. Download the plugin from this page.
2. Save the .zip file to a location on your computer.
3. Open the WP admin panel, and click “Plugins” -> “Add new”.
4. Click “upload”.. then browse to the .zip file downloaded from this page.
5. Click “Install”.. and then “Activate plugin”.



== Frequently Asked Questions ==



== Screenshots ==

1. This screen shot description corresponds to screenshot-1.(png|jpg|jpeg|gif). Note that the screenshot is taken from
the /assets directory or the directory that contains the stable readme.txt (tags or trunk). Screenshots in the /assets
directory take precedence. For example, `/assets/screenshot-1.png` would win over `/tags/4.3/screenshot-1.png`
(or jpg, jpeg, gif).
2. This is the second screen shot

== Changelog ==

= 0.1.0 =
* Release

== Arbitrary section ==
1. PHP class management is now done using Composer.  
[GitHub](https://github.com/itmaroon/block-class-package)  
[Packagist](https://packagist.org/packages/itmar/block-class-package)
 
2. I decided to make functions and components common to other plugins into npm packages, and install and use them from npm.  
[npm](https://www.npmjs.com/package/itmar-block-packages)  
[GitHub](https://github.com/itmaroon/itmar-block-packages)