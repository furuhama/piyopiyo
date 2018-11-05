#!/usr/bin/env ruby

time = Time.now
minipost_title = time.strftime('%Y-%m-%d-%H%M') + '.markdown'
minipost_directory = File.expand_path('../_posts/miniposts', __FILE__)
target_path = minipost_directory + '/' + minipost_title

raise RuntimeError.new "Already exists #{minipost_title}" if File.exist? target_path

File.open(target_path, 'w') do |f|
  f.puts '---'
  f.puts 'layout: post'
  f.puts 'title: '
  f.puts "date: #{time.strftime('%Y-%m-%d %H:%M:%S')}"
  f.puts 'tag: [minipost]'
  f.puts '---'
end

puts "Created: #{minipost_title}"
